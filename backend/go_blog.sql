ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'reader';

UPDATE users SET role = 'writer' WHERE email = 'author@example.com';


-- The teachable query Class Date 03/17/2026
SELECT posts.id, posts.title, posts.content, 
       users.name AS author_name, posts.created_at
FROM posts 
JOIN users ON posts.author_email = users.email
ORDER BY posts.created_at DESC