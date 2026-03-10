package main

import (
	"encoding/json"
	"log"
	"net/http"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// --- Handler Functions ---

func createPost(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", 405)
        return
    }

    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }
    json.NewDecoder(r.Body).Decode(&post)

    _, err := db.Exec("INSERT INTO posts (title, content) VALUES (?, ?)", post.Title, post.Content)
    if err != nil {
        http.Error(w, "Server error", 500)
        return
    }
    w.Write([]byte("Post created successfully"))
}

func getPosts(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query("SELECT id, title, content FROM posts ORDER BY created_at DESC")
    if err != nil {
        http.Error(w, "Server error", 500)
        return
    }
    defer rows.Close()

    var posts []map[string]interface{}
    for rows.Next() {
        var id int
        var title, content string
        rows.Scan(&id, &title, &content)
        posts = append(posts, map[string]interface{}{
            "id": id, "title": title, "content": content,
        })
    }
    json.NewEncoder(w).Encode(posts)
}

func deletePost(w http.ResponseWriter, r *http.Request) {

    id := r.URL.Query().Get("id")
    email := r.URL.Query().Get("email")

    if id == "" || email == "" {
        http.Error(w, "Missing data", http.StatusBadRequest)
        return
    }

    // Check author
    var authorEmail string
    err := db.QueryRow("SELECT author_email FROM posts WHERE id = ?", id).
        Scan(&authorEmail)

    if err != nil {
        http.Error(w, "Post not found", http.StatusNotFound)
        return
    }

    if authorEmail != email {
        http.Error(w, "Unauthorized action", http.StatusForbidden)
        return
    }

    _, err = db.Exec("DELETE FROM posts WHERE id = ?", id)
    if err != nil {
        http.Error(w, "Delete failed", http.StatusInternalServerError)
        return
    }

    w.Write([]byte("Post deleted successfully"))
}
func main() {
	connectDB()
	
	http.Handle("/", http.FileServer(http.Dir("../frontend")))

	http.HandleFunc("/register", register)
	http.HandleFunc("/login", login)
	http.HandleFunc("/create-post", createPost)
	http.HandleFunc("/get-posts", getPosts)
	// http.HandleFunc("/delete-blog", deleteBlog)
    http.HandleFunc("/delete-post", deletePost)
	http.HandleFunc("/update-blog", updateBlog)


	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
func register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var data struct {
		Name     string
		Email    string
		Password string
	}
 
	json.NewDecoder(r.Body).Decode(&data)

	hash, _ := bcrypt.GenerateFromPassword([]byte(data.Password), 10)

	_, err := db.Exec(
	"INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
	data.Name,
	data.Email,
	string(hash),
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
		Email    string
		Password string
	}

	json.NewDecoder(r.Body).Decode(&data)

	var hash string
	err := db.QueryRow(
	"SELECT password_hash FROM users WHERE email = ?",
	data.Email,
).Scan(&hash)


	if err != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(data.Password)) != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	w.Write([]byte("Login successful"))
}


func updateBlog(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPut {
        http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
        return
    }

    id := r.URL.Query().Get("id")
    if id == "" {
        http.Error(w, "ID is required", http.StatusBadRequest)
        return
    }

    var post struct {
        Title   string `json:"title"`
        Content string `json:"content"`
    }

    err := json.NewDecoder(r.Body).Decode(&post)
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