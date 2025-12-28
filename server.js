const express = require("express");
const fs = require("fs");
const multer = require("multer");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(session({
  secret: "insta_clone_secret",
  resave: false,
  saveUninitialized: true
}));

const USERS_FILE = "users.json";
const POSTS_FILE = "posts.json";
const MSG_FILE = "messages.json";

const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : [];
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

if (!fs.existsSync(USERS_FILE)) save(USERS_FILE, []);
if (!fs.existsSync(POSTS_FILE)) save(POSTS_FILE, []);
if (!fs.existsSync(MSG_FILE)) save(MSG_FILE, []);

const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* -------- AUTH -------- */

app.post("/register", (req, res) => {
  const { username, password, name } = req.body;
  const users = load(USERS_FILE);
  if (users.find(u => u.username === username))
    return res.json({ ok: false, msg: "Username exists" });

  users.push({
    username,
    password,
    name,
    bio: "",
    photo: "",
    followers: [],
    following: []
  });
  save(USERS_FILE, users);
  res.json({ ok: true });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = load(USERS_FILE);
  const u = users.find(x => x.username === username && x.password === password);
  if (!u) return res.json({ ok: false });
  req.session.user = username;
  res.json({ ok: true });
});

app.get("/me", (req, res) => {
  if (!req.session.user) return res.json({ ok: false });
  const users = load(USERS_FILE);
  res.json({ ok: true, user: users.find(u => u.username === req.session.user) });
});

/* -------- PROFILE -------- */

app.get("/profile", (req, res) => {
  if (!req.session.user) return res.json({ ok: false });
  const users = load(USERS_FILE);
  const posts = load(POSTS_FILE);
  const me = users.find(u => u.username === req.session.user);
  res.json({ ok: true, user: me, posts: posts.filter(p => p.user === me.username) });
});

app.post("/bio", (req, res) => {
  const users = load(USERS_FILE);
  const me = users.find(u => u.username === req.session.user);
  me.bio = req.body.bio || "";
  save(USERS_FILE, users);
  res.json({ ok: true });
});

app.post("/dp", upload.single("photo"), (req, res) => {
  const users = load(USERS_FILE);
  const me = users.find(u => u.username === req.session.user);
  me.photo = "/uploads/" + req.file.filename;
  save(USERS_FILE, users);
  res.json({ ok: true, photo: me.photo });
});

/* -------- VIEW USER -------- */

app.get("/user/:username", (req, res) => {
  if (!req.session.user) return res.json({ ok: false });
  const users = load(USERS_FILE);
  const posts = load(POSTS_FILE);
  const me = users.find(u => u.username === req.session.user);
  const other = users.find(u => u.username === req.params.username);
  if (!other) return res.json({ ok: false });

  res.json({
    ok: true,
    user: other,
    posts: posts.filter(p => p.user === other.username),
    isFollowing: me.following.includes(other.username)
  });
});

/* -------- SEARCH -------- */

app.get("/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const users = load(USERS_FILE);
  res.json(users.filter(u => u.username.toLowerCase().includes(q)));
});

/* -------- FOLLOW / UNFOLLOW -------- */

app.post("/follow", (req, res) => {
  const { to } = req.body;
  const users = load(USERS_FILE);
  const me = users.find(u => u.username === req.session.user);
  const other = users.find(u => u.username === to);
  if (!me || !other) return res.json({ ok: false });

  if (!me.following.includes(to)) me.following.push(to);
  if (!other.followers.includes(me.username)) other.followers.push(me.username);
  save(USERS_FILE, users);
  res.json({ ok: true });
});

app.post("/unfollow", (req, res) => {
  const { to } = req.body;
  const users = load(USERS_FILE);
  const me = users.find(u => u.username === req.session.user);
  const other = users.find(u => u.username === to);

  me.following = me.following.filter(u => u !== to);
  other.followers = other.followers.filter(u => u !== me.username);
  save(USERS_FILE, users);
  res.json({ ok: true });
});

app.get("/followers/:u", (req, res) => {
  const users = load(USERS_FILE);
  const u = users.find(x => x.username === req.params.u);
  res.json(u ? u.followers : []);
});

/* -------- POSTS -------- */

app.post("/post", upload.single("image"), (req, res) => {
  const posts = load(POSTS_FILE);
  posts.unshift({
    id: Date.now(),
    user: req.session.user,
    image: "/uploads/" + req.file.filename,
    caption: req.body.caption || "",
    likes: [],
    comments: []
  });
  save(POSTS_FILE, posts);
  res.redirect("/feed.html");
});

app.get("/feed", (req, res) => {
  const users = load(USERS_FILE);
  const posts = load(POSTS_FILE);
  const me = users.find(u => u.username === req.session.user);
  res.json(posts.filter(p => p.user === me.username || me.following.includes(p.user)));
});

/* -------- LIKE / UNLIKE -------- */

app.post("/like", (req, res) => {
  const posts = load(POSTS_FILE);
  const p = posts.find(x => x.id == req.body.id);
  const u = req.session.user;

  if (p.likes.includes(u))
    p.likes = p.likes.filter(x => x !== u);
  else
    p.likes.push(u);

  save(POSTS_FILE, posts);
  res.json({ ok: true });
});

/* -------- COMMENTS -------- */

app.post("/comment", (req, res) => {
  const { id, text } = req.body;
  const posts = load(POSTS_FILE);
  const p = posts.find(x => x.id == id);
  p.comments.push({ user: req.session.user, text });
  save(POSTS_FILE, posts);
  res.json({ ok: true });
});

/* -------- DM CHAT -------- */

app.get("/dm/:u", (req, res) => {
  const msgs = load(MSG_FILE);
  const me = req.session.user;
  const other = req.params.u;
  res.json(msgs.filter(m =>
    (m.from === me && m.to === other) ||
    (m.from === other && m.to === me)
  ));
});

app.post("/dm", (req, res) => {
  const { to, text } = req.body;
  const msgs = load(MSG_FILE);
  msgs.push({ from: req.session.user, to, text, time: Date.now() });
  save(MSG_FILE, msgs);
  res.json({ ok: true });
});

app.listen(PORT, () =>
  console.log("🚀 InstaClone running at http://localhost:" + PORT)
);
