fetch("/profile")
  .then(r => r.json())
  .then(d => {
    if (!d.ok) return location.href = "/";
    dp.src = d.user.photo || "https://via.placeholder.com/100";
    name.textContent = d.user.name + " (@" + d.user.username + ")";
    bio.textContent = d.user.bio || "No bio yet";
    bioEdit.value = d.user.bio || "";
    followers.textContent = d.user.followers.length;
    following.textContent = d.user.following.length;

    posts.innerHTML = "";
    d.posts.forEach(p => {
      posts.innerHTML += `<img src="${p.image}" class="postThumb">`;
    });
  });

function saveBio() {
  fetch("/bio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bio: bioEdit.value })
  }).then(() => location.reload());
}

function uploadDP() {
  const f = dpFile.files[0];
  const fd = new FormData();
  fd.append("photo", f);
  fetch("/dp", { method: "POST", body: fd })
    .then(r => r.json())
    .then(d => dp.src = d.photo);
}
