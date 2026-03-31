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
  const btn = document.querySelector(".editor-card button");

  if (!title || !content) {
    alert("Fill all fields");
    return;
  }

  //  Disable button while request is in flight
  btn.disabled = true;
  btn.innerText = editingId ? "Updating..." : "Publishing...";
  // to inform the user that the post is being published or updated

  const url = editingId
    ? `http://localhost:8080/update-blog?id=${editingId}`
    : "http://localhost:8080/create-post";

  const method = editingId ? "PUT" : "POST";
  // Put will be used for updating the post and post will be used for the creation of the new post

  fetch(url, {
    method,
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  })
    .then((res) => {
      if (!res.ok)
        return res.text().then((t) => {
          throw new Error(t);
        });
      return res.text();
    })
    .then((msg) => {
      showToast(msg, "success"); //  Toast instead of alert
      resetEditor();
      getPosts();
    })
    .catch((err) => {
      showToast(err.message, "error");
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerText = editingId ? "Update Post" : "Publish Story";
    });
}

function getPosts() {
  const { email, role } = getSession();
  const isWriter = role === "writer";
  const feed = document.getElementById("blogFeed");

  //  Show loader while fetching
  feed.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading posts...</p>
    </div>
  `;

  const editorCard = document.querySelector(".editor-card");
  if (editorCard) editorCard.style.display = isWriter ? "block" : "none";

  const usernameEl = document.getElementById("username");
  if (usernameEl)
    usernameEl.textContent = localStorage.getItem("userName") || "Guest";

  fetch("http://localhost:8080/get-posts")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    })
    .then((posts) => {
      if (!posts || posts.length === 0) {
        feed.innerHTML = `
          <div class="empty-state">
            <p>📭 No posts yet. Be the first to write!</p>
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
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Unknown date";

          return `
            <article class="post-card" id="post-${post.id}">
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
    })
    .catch((err) => {
      //  Show error state
      feed.innerHTML = `
        <div class="error-state">
          <p>⚠️ Could not load posts. Please refresh.</p>
        </div>
      `;
    });
}

function deleteBlog(id) {
  fetch(`http://localhost:8080/delete-post?id=${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
    .then((res) => {
      if (!res.ok)
        return res.text().then((t) => {
          throw new Error(t);
        });
      return res.text();
    })
    .then((msg) => {
      showToast(msg, "success"); //  Toast instead of alert
      getPosts();
    })
    .catch((err) => showToast(err.message, "error"));
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

//  Auth guard — runs on every page load
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

guardRoute(); //  Call immediately on script load

//  Toast notification — replaces all alerts
function showToast(message, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
//  Client-side search — no API call needed
function filterPosts() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const cards = document.querySelectorAll(".post-card");

  let visibleCount = 0;

  cards.forEach((card) => {
    const title = card.querySelector("h3").innerText.toLowerCase();
    const content = card.querySelector("p").innerText.toLowerCase();
    const matches = title.includes(query) || content.includes(query);

    card.style.display = matches ? "block" : "none";
    if (matches) visibleCount++;
  });

  //  Show "no results" if nothing matches
  const noResult = document.getElementById("noSearchResult");
  if (visibleCount === 0 && query !== "") {
    if (!noResult) {
      const msg = document.createElement("div");
      msg.id = "noSearchResult";
      msg.className = "empty-state";
      msg.innerText = `No posts found for "${query}"`;
      document.getElementById("blogFeed").after(msg);
    }
  } else {
    if (noResult) noResult.remove();
  }
}
let currentPage = 1;

function changePage(direction) {
  currentPage += direction;
  if (currentPage < 1) currentPage = 1;
  getPosts();
}

// Update getPosts fetch URL to include page
fetch(`http://localhost:8080/get-posts?page=${currentPage}`)

//  Update page label after fetch
document.getElementById("pageLabel").innerText = `Page ${currentPage}`;
document.getElementById("prevBtn").disabled = currentPage === 1;