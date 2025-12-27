const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Load messages from JSON file
let messages = [];
const filePath = "messages.json";
if (fs.existsSync(filePath)) {
  messages = JSON.parse(fs.readFileSync(filePath));
}

// Socket.IO
io.on("connection", (socket) => {
  console.log("User connected");

  // Send old messages
  socket.emit("oldMessages", messages);

  // Receive new message
  socket.on("chatMessage", (msg) => {
    messages.push(msg);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    io.emit("chatMessage", msg);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});