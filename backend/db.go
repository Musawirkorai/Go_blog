package main

import (
	"database/sql"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

func connectDB() {
	var err error

	db, err = sql.Open(
		"mysql",
		"root:@tcp(localhost:3306)/blog_auth",
	)

	if err != nil {
		log.Fatal(err)
	}

	if err = db.Ping(); err != nil {
		log.Fatal("Database connection failed")
	}

	log.Println("MySQL connected successfully")
}
