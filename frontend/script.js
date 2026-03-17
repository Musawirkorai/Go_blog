let editingId = null;

// - Helper: get session from localStorage
function getSession() {
  return {
    email: localStorage.getItem("userEmail"),
    role: localStorage.getItem("userRole"),
    name: localStorage.getItem("userName"),
  };
}

// - Helper: build auth headers
function authHeaders() {
  const { email, role } = getSession();
  return {
    "Content-Type": "application/json",
    "X-User-Email": email || "",
    "X-User-Role": role || "",
  };
}

//Renamed from register() to avoid browser built-in conflict
function registerUser() {
  const nameVal = document.getElementById("name")?.value?.trim();
  const emailVal = document.getElementById("email")?.value?.trim();
  const passwordVal = document.getElementById("password")?.value;
  const roleVal = document.getElementById("role")?.value || "reader";

  if (!nameVal || !emailVal || !passwordVal) {
    alert("Please fill in all fields");
    return;
  }

  fetch("http://localhost:8080/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nameVal,
      email: emailVal,
      password: passwordVal,
      role: roleVal,
    }),
  })
    .then((res) => {
      if (!res.ok)
        return res.text().then((t) => {
          throw new Error(t);
        });
      return res.text();
    })
    .then((msg) => {
      alert(msg);
      window.location.href = "index.html";
    })
    .catch((err) => alert("Signup failed: " + err.message));
}

function login() {
  fetch("http://localhost:8080/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.getElementById("loginEmail").value,
      password: document.getElementById("loginPassword").value,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Login failed");
      return res.json(); // - Now returns JSON with role
    })
    .then((user) => {
      // - Store session
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userName", user.name);
      window.location.href = "home.html";
    })
    .catch(() => alert("Invalid email or password"));
}




function logout() {
  //it will remove all the tokens and sessions will be deleted to log out the user and also all the user information will be removed from the local storage and then it will redirect to the login page
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  // Default page will be the index.html
  window.location.href = "index.html";
}








function createPost() {
  const title = document.getElementById("postTitle").value;
  const content = document.getElementById("postContent").value;

  if (!title || !content) {
    alert("Fill all fields");
    return;
  }

  if (editingId) {
    fetch(`http://localhost:8080/update-blog?id=${editingId}`, {
      method: "PUT",
      headers: authHeaders(), // - Send auth
      body: JSON.stringify({ title, content }),
    })
      .then((res) => res.text())
      .then((msg) => {
        alert(msg);
        resetEditor();
        getPosts();
      });
  } else {
    fetch("http://localhost:8080/create-post", {
      method: "POST",
      headers: authHeaders(), // - Send auth
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
  const { email, role } = getSession();
  const isWriter = role === "writer";

  // Show/hide editor based on role
  const editorCard = document.querySelector(".editor-card");
  if (editorCard) {
    editorCard.style.display = isWriter ? "block" : "none";
  }

  // Show username
  const usernameEl = document.getElementById("username");
  if (usernameEl) {
    usernameEl.textContent = localStorage.getItem("userName") || "Guest";
  }

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
      .map((post) => {
        const isOwner = isWriter && post.author_email === email;
        const actions = isOwner
          ? `<div class="post-actions">
              <button onclick="editBlog(${post.id}, \`${post.title}\`, \`${post.content}\`)">Edit</button>
              <button class="delete-btn" onclick="deleteBlog(${post.id})">Delete</button>
            </div>`
          : "";

        const dateStr = post.created_at
          ? new Date(post.created_at).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric"
            })
          : "Unknown date";

        return `
          <article class="post-card">
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            <div class="post-meta">
              <span>By ${post.author_name}</span>
              <span>${dateStr}</span>
            </div>
            ${actions}
          </article>
        `;
      })
      .join("");
    });
}

function deleteBlog(id) {
  fetch(`http://localhost:8080/delete-post?id=${id}`, {
    method: "DELETE",
    headers: authHeaders(), //  Email in header, not URL
  })
    .then((res) => res.text())
    .then((msg) => {
      alert(msg);
      getPosts();
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

// ✅ Auth guard — runs on every page load
function guardRoute() {
  const protectedPages = ["home.html"];
  const currentPage = window.location.pathname.split("/").pop();

  if (protectedPages.includes(currentPage)) {
    const email = localStorage.getItem("userEmail");
    const role = localStorage.getItem("userRole");

    if (!email || !role) {
      alert("Please login first");
      window.location.href = "index.html";
    }
  }
}

guardRoute(); // ✅ Call immediately on script load
