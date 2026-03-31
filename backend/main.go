package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
    

	"golang.org/x/crypto/bcrypt"
)

// --- Middleware: only writers can access ---
func writerOnly(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        email := r.Header.Get("X-User-Email")
        role := r.Header.Get("X-User-Role")

        if email == "" || role == "" {
            http.Error(w, "Unauthorized: not logged in", http.StatusUnauthorized)
            return
        }

        if strings.ToLower(role) != "writer" {
            http.Error(w, "Forbidden: writers only", http.StatusForbidden)
            return
        }

        next(w, r)
    }
}

func createPost(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", 405)
        return
    }

    authorEmail := r.Header.Get("X-User-Email")

    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }
    json.NewDecoder(r.Body).Decode(&post)

    if errMsg := validatePost(post.Title, post.Content); errMsg != "" {
        http.Error(w, errMsg, http.StatusBadRequest)
        return
    }

    _, err := db.Exec(
        "INSERT INTO posts (title, content, author_email) VALUES (?, ?, ?)",
        post.Title, post.Content, authorEmail,
    )
    if err != nil {
        http.Error(w, "Server error", 500)
        return
    }
    w.Write([]byte("Post created successfully"))
}
func getPosts(w http.ResponseWriter, r *http.Request) {
    //  Read page from query param e.g. /get-posts?page=1
    pageStr := r.URL.Query().Get("page")
    page := 1
    if pageStr != "" {
        fmt.Sscanf(pageStr, "%d", &page)
    }
    if page < 1 {
        page = 1
    }

    limit := 5
    offset := (page - 1) * limit

    query := `
        SELECT posts.id, posts.title, posts.content,
               users.name AS author_name,
               posts.author_email,
               posts.created_at
        FROM posts
        JOIN users ON posts.author_email = users.email
        ORDER BY posts.created_at DESC
        LIMIT ? OFFSET ?
    `
    rows, err := db.Query(query, limit, offset)
    if err != nil {
        http.Error(w, "Server error", 500)
        return
    }
    defer rows.Close()

    var posts []map[string]interface{}
    for rows.Next() {
        var id int
        var title, content, authorName, authorEmail, createdAt string
        rows.Scan(&id, &title, &content, &authorName, &authorEmail, &createdAt)
        posts = append(posts, map[string]interface{}{
            "id":           id,
            "title":        title,
            "content":      content,
            "author_name":  authorName,
            "author_email": authorEmail,
            "created_at":   createdAt,
        })
    }
    json.NewEncoder(w).Encode(posts)
}
func deletePost(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("id")
    email := r.Header.Get("X-User-Email") // - From header, not query param

    if id == "" || email == "" {
        http.Error(w, "Missing data", http.StatusBadRequest)
        return
    }

    var authorEmail string
    err := db.QueryRow("SELECT author_email FROM posts WHERE id = ?", id).Scan(&authorEmail)
    if err != nil {
        http.Error(w, "Post not found", http.StatusNotFound)
        return
    }

    if authorEmail != email {
        http.Error(w, "Unauthorized: not your post", http.StatusForbidden)
        return
    }

    _, err = db.Exec("DELETE FROM posts WHERE id = ?", id)
    if err != nil {
        http.Error(w, "Delete failed", http.StatusInternalServerError)
        return
    }

    w.Write([]byte("Post deleted successfully"))
}

func updateBlog(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPut {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    id := r.URL.Query().Get("id")
    email := r.Header.Get("X-User-Email")

    if id == "" {
        http.Error(w, "ID is required", http.StatusBadRequest)
        return
    }

    // Check ownership
    var authorEmail string
    err := db.QueryRow("SELECT author_email FROM posts WHERE id = ?", id).Scan(&authorEmail)
    if err != nil {
        http.Error(w, "Post not found", http.StatusNotFound)
        return
    }
    if authorEmail != email {
        http.Error(w, "Unauthorized: not your post", http.StatusForbidden)
        return
    }

    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }

    if errMsg := validatePost(post.Title, post.Content); errMsg != "" {
        http.Error(w, errMsg, http.StatusBadRequest)
        return
    }

    err = json.NewDecoder(r.Body).Decode(&post)
    if err != nil {
        http.Error(w, "Invalid data", http.StatusBadRequest)
        return
    }

    _, err = db.Exec("UPDATE posts SET title=?, content=? WHERE id=?",
        post.Title, post.Content, id)
    if err != nil {
        fmt.Println("UPDATE ERROR:", err)
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }

    w.Write([]byte("Blog updated successfully"))
}

func register(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", 405)
        return
    }

    var data struct {
        Name     string `json:"name"`
        Email    string `json:"email"`
        Password string `json:"password"`
        Role     string `json:"role"` // "reader" or "writer"
    }

    json.NewDecoder(r.Body).Decode(&data)

    // Default to reader if no role specified
    if data.Role != "writer" {
        data.Role = "reader"
    }
    // default role will be reader

    hash, _ := bcrypt.GenerateFromPassword([]byte(data.Password), 10)

    _, err := db.Exec(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        data.Name, data.Email, string(hash), data.Role,
    )
    if err != nil {
        http.Error(w, "User already exists", 400)
        return
    }

    w.Write([]byte("User registered successfully"))
}

func login(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", 405)
        return
    }

    var data struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }

    json.NewDecoder(r.Body).Decode(&data)

    var hash, role, name string
    err := db.QueryRow(
        "SELECT password_hash, role, name FROM users WHERE email = ?",
        data.Email,
    ).Scan(&hash, &role, &name)

    if err != nil {
        http.Error(w, "Invalid email or password", 401)
        return
    }

    if bcrypt.CompareHashAndPassword([]byte(hash), []byte(data.Password)) != nil {
        http.Error(w, "Invalid email or password", 401)
        return
    }

    //  Return user info as JSON
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "email": data.Email,
        "role":  role,
        "name":  name,
    })
}

//  Reusable validation helper so the empty blog is not uploaded on the DataBase in other words to prevent uploading empty Blog on the DataBase
func validatePost(title, content string) string {
    if strings.TrimSpace(title) == "" {
        return "Title cannot be empty"
    }
    if strings.TrimSpace(content) == "" {
        return "Content cannot be empty"
    }
    if len(title) > 100 {
        return "Title must be under 100 characters"
    }
    if len(content) > 5000 {
        return "Content must be under 5000 characters"
    }
    return "" // empty = valid
}

func main() {
    connectDB()

    http.Handle("/", http.FileServer(http.Dir("../frontend")))

    http.HandleFunc("/register", register)
    http.HandleFunc("/login", login)
    http.HandleFunc("/get-posts", getPosts) 

    http.HandleFunc("/create-post", writerOnly(createPost))
    http.HandleFunc("/delete-post", writerOnly(deletePost))
    http.HandleFunc("/update-blog", writerOnly(updateBlog))

    log.Println("Server running on http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}