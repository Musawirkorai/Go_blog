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
