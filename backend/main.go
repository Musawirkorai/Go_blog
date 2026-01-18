package main

import (
	"encoding/json"
	"log"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	connectDB()
	
	http.Handle("/", http.FileServer(http.Dir("../frontend")))

	http.HandleFunc("/register", register)
	http.HandleFunc("/login", login)

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
