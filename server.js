const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const usersFile = "users.json";
const msgFile = "messages.json";

let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
let messages = fs.existsSync(msgFile) ? JSON.parse(fs.readFileSync(msgFile)) : [];

let otps = {}; // email -> otp
let onlineUsers = {}; // username -> socket.id

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}
function saveMsgs() {
  fs.writeFileSync(msgFile, JSON.stringify(messages, null, 2));
}

// 📷 multer setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 📩 Send OTP (demo or with email if added)
app.post("/send-otp", (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[email] = otp;
  console.log("OTP for", email, "is:", otp);
  res.json({ ok: true });
});

// 🆕 Register with photo
app.post("/verify-register", upload.single("photo"), (req, res) => {
  const { email, otp, username, password } = req.body;

  if (otps[email] !== otp)
    return res.json({ ok: false, msg: "Invalid OTP" });

  if (users.find(u => u.username === username))
    return res.json({ ok: false, msg: "Username exists" });

  const photoPath = req.file ? "/uploads/" + req.file.filename : "";

  users.push({ email, username, password, photo: photoPath });
  saveUsers();
  delete otps[email];

  res.json({ ok: true });
});

// 🔑 Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    u => u.username === username && u.password === password
  );
  if (!user) return res.json({ ok: false, msg: "Invalid login" });
  res.json({ ok: true, user });
});

// 🔄 Update profile photo
app.post("/update-photo", upload.single("photo"), (req, res) => {
  const { username } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) return res.json({ ok: false });

  user.photo = req.file ? "/uploads/" + req.file.filename : user.photo;
  saveUsers();

  res.json({ ok: true, photo: user.photo });
});


// 👥 Get user list
app.get("/users", (req, res) => {
  res.json(users.map(u => ({ username: u.username, photo: u.photo })));
});

// 🔌 Socket private chat
io.on("connection", socket => {

  socket.on("join", username => {
    onlineUsers[username] = socket.id;
  });

  socket.on("loadChat", ({ from, to }) => {
    const chat = messages.filter(
      m =>
        (m.from === from && m.to === to) ||
        (m.from === to && m.to === from)
    );
    socket.emit("chatHistory", chat);
  });

  socket.on("privateMessage", msg => {
    messages.push(msg);
    saveMsgs();

    const toSocket = onlineUsers[msg.to];
    if (toSocket) io.to(toSocket).emit("privateMessage", msg);
    socket.emit("privateMessage", msg);
  });

  socket.on("disconnect", () => {
    for (let u in onlineUsers) {
      if (onlineUsers[u] === socket.id) delete onlineUsers[u];
    }
  });
});

server.listen(4000, () => {
  console.log("Server running: http://localhost:4000");
});

