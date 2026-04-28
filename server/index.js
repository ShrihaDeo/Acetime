const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "http://localhost:5173", // This allows your React app to connect
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected to Sync Server:', socket.id);

  // Listen for a test move
  socket.on('send-move', (data) => {
    socket.broadcast.emit('receive-move', data);
  });
});

http.listen(3000, () => {
  console.log('Sync Server is running on http://localhost:3000');
});