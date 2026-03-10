ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'reader';

UPDATE users SET role = 'writer' WHERE email = 'author@example.com';