//
// STATE
//
let editingId = null;
let postToDelete = null;
let currentPage = 1;

//
// AUTH GUARD — runs immediately on every page load
//
function guardRoute() {
  const protectedPages = ["home.html"];
  const currentPage = window.location.pathname.split("/").pop();
  if (protectedPages.includes(currentPage)) {
    if (!localStorage.getItem("userEmail")) {
      alert("Please login first");
      window.location.href = "index.html";
    }
  }
}
guardRoute();

//
// SESSION HELPERS
//
function getSession() {
  return {
    email: localStorage.getItem("userEmail"),
    role: localStorage.getItem("userRole"),
    name: localStorage.getItem("userName"),
  };
}

function authHeaders() {
  const { email, role } = getSession();
  return {
    "Content-Type": "application/json",
    "X-User-Email": email || "",
    "X-User-Role": role || "",
  };
}

//
// RESPONSE HANDLER — parses JSON success/error from backend
//
function handleResponse(res) {
  return res.json().then((data) => {
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data.message || "Done";
  });
}

//
// AUTH — register, login, logout
//
function registerUser() {
  const nameVal = document.getElementById("name")?.value?.trim();
  const emailVal = document.getElementById("email")?.value?.trim();
  const passwordVal = document.getElementById("password")?.value;
  const roleVal = document.getElementById("role")?.value || "reader";

  if (!nameVal || !emailVal || !passwordVal) {
    showToast("Please fill in all fields", "error");
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
    .then(handleResponse)
    .then((msg) => {
      showToast(msg, "success");
      setTimeout(() => (window.location.href = "index.html"), 1200);
    })
    .catch((err) => showToast("Signup failed: " + err.message, "error"));
}

function login() {
  const emailVal = document.getElementById("loginEmail")?.value?.trim();
  const passwordVal = document.getElementById("loginPassword")?.value;

  if (!emailVal || !passwordVal) {
    showToast("Please fill in all fields", "error");
    return;
  }

  fetch("http://localhost:8080/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailVal, password: passwordVal }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Invalid email or password");
      return res.json();
    })
    .then((user) => {
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userName", user.name);
      window.location.href = "home.html";
    })
    .catch((err) => showToast(err.message, "error"));
}

function logout() {
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  window.location.href = "index.html";
}

// POSTS — create, read, update, delete
//
function getPosts() {
  const { email, role } = getSession();
  const isWriter = role === "writer";
  const feed = document.getElementById("blogFeed");

  // Show/hide editor based on role
  const editorCard = document.getElementById("editorCard");
  if (editorCard) editorCard.style.display = isWriter ? "block" : "none";

  // Show username in header
  const usernameEl = document.getElementById("username");
  if (usernameEl) usernameEl.textContent = getSession().name || "Reader";

  // Loading state
  feed.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading posts...</p>
    </div>
  `;

  // Update pagination UI
  document.getElementById("pageLabel").textContent = `Page ${currentPage}`;
  document.getElementById("prevBtn").disabled = currentPage === 1;

  fetch(`http://localhost:8080/get-posts?page=${currentPage}`)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    })
    .then((posts) => {
      //    Fix: handle null response from Go when no posts exist
      if (!posts || posts.length === 0) {
        feed.innerHTML = `
          <div class="empty-state">
            <p>📭 No posts yet. Be the first to write!</p>
          </div>
        `;
        document.getElementById("nextBtn").disabled = true;
        return;
      }

      // Disable next if fewer results than page size (5)
      document.getElementById("nextBtn").disabled = posts.length < 5;

      feed.innerHTML = posts
        .map((post) => {
          const isOwner = isWriter && post.author_email === email;
          const actions = isOwner
            ? `<div class="post-actions">
                <button onclick="editBlog(${post.id}, \`${post.title}\`, \`${post.content}\`)">✏️ Edit</button>
                <button class="delete-btn" onclick="deleteBlog(${post.id})">🗑️ Delete</button>
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
    .catch(() => {
      feed.innerHTML = `
        <div class="error-state">
          <p>⚠️ Could not load posts. Please refresh.</p>
        </div>
      `;
    });
}

function createPost() {
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const btn = document.getElementById("publishBtn");

  if (!title || !content) {
    showToast("Please fill in all fields", "error");
    return;
  }

  btn.disabled = true;
  btn.innerText = editingId ? "Updating..." : "Publishing...";

  const url = editingId
    ? `http://localhost:8080/update-blog?id=${editingId}`
    : "http://localhost:8080/create-post";

  fetch(url, {
    method: editingId ? "PUT" : "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  })
    .then(handleResponse)
    .then((msg) => {
      showToast(msg, "success");
      resetEditor();
      getPosts();
    })
    .catch((err) => showToast(err.message, "error"))
    .finally(() => {
      btn.disabled = false;
      btn.innerText = editingId ? "Update Post" : "Publish Story";
    });
}

function editBlog(id, title, content) {
  document.getElementById("postTitle").value = title;
  document.getElementById("postContent").value = content;

  // Update counters to reflect loaded values
  updateCounter("postTitle", "titleCounter", 150);
  updateCounter("postContent", "contentCounter", 6000);

  editingId = id;
  document.getElementById("publishBtn").innerText = "Update Post";

  // Scroll to editor
  document.getElementById("editorCard").scrollIntoView({ behavior: "smooth" });
}

function resetEditor() {
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  updateCounter("postTitle", "titleCounter", 100);
  updateCounter("postContent", "contentCounter", 5000);
  editingId = null;
  document.getElementById("publishBtn").innerText = "Publish Story";
}

function deleteBlog(id) {
  postToDelete = id;
  document.getElementById("deleteModal").classList.add("modal-visible");
}

function closeModal() {
  postToDelete = null;
  document.getElementById("deleteModal").classList.remove("modal-visible");
}

document.getElementById("confirmDelete").onclick = function () {
  if (!postToDelete) return;

  fetch(`http://localhost:8080/delete-post?id=${postToDelete}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
    .then(handleResponse)
    .then((msg) => {
      showToast(msg, "success");
      closeModal();
      getPosts();
    })
    .catch((err) => {
      showToast(err.message, "error");
      closeModal();
    });
};

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function filterPosts() {
  const query = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();
  const cards = document.querySelectorAll(".post-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const title = card.querySelector("h3").innerText.toLowerCase();
    const content = card.querySelector("p").innerText.toLowerCase();
    const matches = title.includes(query) || content.includes(query);
    card.style.display = matches ? "block" : "none";
    if (matches) visibleCount++;
  });

  const existing = document.getElementById("noSearchResult");
  if (visibleCount === 0 && query !== "") {
    if (!existing) {
      const msg = document.createElement("div");
      msg.id = "noSearchResult";
      msg.className = "empty-state";
      msg.innerText = `No posts found for "${query}"`;
      document.getElementById("blogFeed").after(msg);
    }
  } else {
    if (existing) existing.remove();
  }
}

function changePage(direction) {
  currentPage += direction;
  if (currentPage < 1) currentPage = 1;
  getPosts();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateCounter(inputId, counterId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;

  const length = input.value.length;
  counter.textContent = `${length} / ${max}`;

  if (length >= max) {
    counter.style.color = "#ef4444";
  } else if (length >= max * 0.85) {
    counter.style.color = "#f59e0b";
  } else {
    counter.style.color = "#888";
  }
}
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
