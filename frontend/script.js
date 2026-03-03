let editingId = null;
function register() {
  fetch("http://localhost:8080/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.value,
      email: email.value,
      password: password.value,
    }),
  })
    .then((res) => res.text())
    .then((msg) => {
      alert(msg);
      window.location.href = "index.html";
    });
}

function login() {
  fetch("http://localhost:8080/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: loginEmail.value,
      password: loginPassword.value,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Login failed");
      return res.text();
    })
    .then(() => {
      window.location.href = "home.html";
    })
    .catch(() => alert("Invalid email or password"));
}

function createPost() {
  const title = document.getElementById("postTitle").value;
  const content = document.getElementById("postContent").value;

  if (!title || !content) {
    alert("Fill all fields");
    return;
  }

  if (editingId) {
    // UPDATE
    fetch(`http://localhost:8080/update-blog?id=${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    })
      .then((res) => res.text())
      .then((msg) => {
        alert(msg);
        resetEditor();
        getPosts();
      });
  } else {
    // CREATE
    fetch("http://localhost:8080/create-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    })
      .then((res) => res.text())
      .then((msg) => {
        alert(msg);
        resetEditor();
        getPosts();
      });
  }
}

function getPosts() {
  fetch("http://localhost:8080/get-posts")
    .then((res) => res.json())
    .then((posts) => {
      const feed = document.getElementById("blogFeed");

      if (!posts || posts.length === 0) {
        feed.innerHTML = `
          <div class="post-card" style="text-align:center;">
            No posts yet. Start the conversation!
          </div>
        `;
        return;
      }

      feed.innerHTML = posts
        .map(
          (post) => `
        <article class="post-card">
          <h3>${post.title}</h3>
          <p>${post.content}</p>
          <div class="post-meta">
            <span>By Anonymous</span>
            <span>${new Date().toLocaleDateString()}</span>
          </div>
          <div class="post-actions">
            <button onclick="editBlog(${post.id}, \`${post.title}\`, \`${post.content}\`)">
              Edit
            </button>
            <button class="delete-btn" onclick="deleteBlog(${post.id})">
              Delete
            </button>
          </div>
        </article>
      `,
        )
        .join("");
    });
}

function deleteBlog(id) {
  if (!confirm("Are you sure you want to delete this story?")) return;

  fetch(`http://localhost:8080/delete-blog?id=${id}`, {
    method: "DELETE",
  })
    .then((res) => res.text())
    .then((msg) => {
      alert(msg);
      getPosts(); // reload posts without full page refresh
    })
    .catch((err) => {
      console.error(err);
      alert("Failed to delete post");
    });
}

function editBlog(id, title, content) {
  document.getElementById("postTitle").value = title;
  document.getElementById("postContent").value = content;

  editingId = id;

  const btn = document.querySelector(".editor-card button");
  btn.innerText = "Update Post";
}

function resetEditor() {
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  editingId = null;

  const btn = document.querySelector(".editor-card button");
  btn.innerText = "Publish Story";
}
