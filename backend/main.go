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
        jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    authorEmail := r.Header.Get("X-User-Email")
    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }
    json.NewDecoder(r.Body).Decode(&post)

    if errMsg := validatePost(post.Title, post.Content); errMsg != "" {
        jsonError(w, errMsg, http.StatusBadRequest)
        return
    }
    _, err := db.Exec(
        "INSERT INTO posts (title, content, author_email) VALUES (?, ?, ?)",
        strings.TrimSpace(post.Title), strings.TrimSpace(post.Content), authorEmail,
    )
    if err != nil {
        jsonError(w, "Failed to create post", http.StatusInternalServerError)
        return
    }
    jsonSuccess(w, "Post created successfully")
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
// In deletePost
func deletePost(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("id")
    email := r.Header.Get("X-User-Email")

    if id == "" || email == "" {
        jsonError(w, "Missing data", http.StatusBadRequest)
        return
    }
    var authorEmail string
    err := db.QueryRow("SELECT author_email FROM posts WHERE id = ?", id).Scan(&authorEmail)
    if err != nil {
        jsonError(w, "Post not found", http.StatusNotFound)
        return
    }
    if authorEmail != email {
        jsonError(w, "You can only delete your own posts", http.StatusForbidden)
        return
    }
    _, err = db.Exec("DELETE FROM posts WHERE id = ?", id)
    if err != nil {
        jsonError(w, "Delete failed", http.StatusInternalServerError)
        return
    }
    jsonSuccess(w, "Post deleted successfully")
}
func updateBlog(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPut {
        jsonError(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    id := r.URL.Query().Get("id")
    email := r.Header.Get("X-User-Email")

    if id == "" {
        jsonError(w, "ID is required", http.StatusBadRequest)
        return
    }

    // Check ownership
    var authorEmail string
    err := db.QueryRow("SELECT author_email FROM posts WHERE id = ?", id).Scan(&authorEmail)
    if err != nil {
        jsonError(w, "Post not found", http.StatusNotFound)
        return
    }
    if authorEmail != email {
        jsonError(w, "Unauthorized: not your post", http.StatusForbidden)
        return
    }

    //    Decode FIRST, then validate
    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }
    if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
        jsonError(w, "Invalid data", http.StatusBadRequest)
        return
    }

    if errMsg := validatePost(post.Title, post.Content); errMsg != "" {
        jsonError(w, errMsg, http.StatusBadRequest)
        return
    }

    _, err = db.Exec(
        "UPDATE posts SET title=?, content=? WHERE id=?",
        strings.TrimSpace(post.Title), strings.TrimSpace(post.Content), id,
    )
    if err != nil {
        jsonError(w, "Database error", http.StatusInternalServerError)
        return
    }

    jsonSuccess(w, "Blog updated successfully")
}
func register(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var data struct {
        Name     string `json:"name"`
        Email    string `json:"email"`
        Password string `json:"password"`
        Role     string `json:"role"`
    }
    json.NewDecoder(r.Body).Decode(&data)

    if data.Role != "writer" {
        data.Role = "reader"
    }

    hash, _ := bcrypt.GenerateFromPassword([]byte(data.Password), 10)

    _, err := db.Exec(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        data.Name, data.Email, string(hash), data.Role,
    )
    if err != nil {
        jsonError(w, "User already exists", http.StatusBadRequest)
        return
    }

    jsonSuccess(w, "User registered successfully")
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
//    Consistent JSON error responses
func jsonError(w http.ResponseWriter, message string, code int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(map[string]string{
        "error": message,
    })
}

//  Consistent JSON success responses  
func jsonSuccess(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": message,
    })
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