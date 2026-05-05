// server/index.js
// express is the framework that turn Node.js into a web server
import express from 'express';
// handles the raw connection between computers
import { createServer } from 'http';
// socket.io is the library that makes real-time communication easy
import { Server } from 'socket.io';

// Create an Express app and an HTTP server
const app = express();
const httpServer = createServer(app);

// 1. Initialise Socket.io with CORS, CORS stands for Cross-Origin Resource Sharing
// It’s a security feature in web browsers that restricts web pages from making requests to a different domain than the one that served the web page.
// This allows your React app (on port 5173) to talk to this server (on port 3000)
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// 2. Handle Connections
// Whenever a player opens the website, the function triggers
// Each player get a unique socket.id
io.on('connection', (socket) => {
  console.log('User connected to Sync Server:', socket.id);

  // Join a specific room for a game session
  socket.on('join-room', (roomID) => {
    const cleanRoomID = roomID.trim().toLowerCase(); // Clean the room ID
    socket.join(roomID);
    console.log(`User ${socket.id} joined room ${roomID}`);
  });

  socket.on("register-peer", ({room, peerId}) => {
    console.log(`Peer registered in room ${room}:`, peerId);
    socket.to(room).emit("peer-joined", peerId);
  });

  socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
    });

  // 3. LISTEN for a move from a player
  // Send move only to other in the same room
  socket.on('send-move', (data) => {
    console.log(`Move in room ${data.room}:`, data);
    // This is where you would add any game logic to validate the move, update the game state on the server, etc.
    // This tells everyone else to move the card on their screen
    socket.to(data.room).emit('receive-move', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// A simple object to store the 'truth' for each room
const roomStates = {}; 
// When  a player joins a room
io.on('connection', (socket) => {
  socket.on('join-room', (roomID) => {
    socket.join(roomID);
    
    // If this room already has a count, send it to the NEW player immediately
    if (roomStates[roomID] !== undefined) {
      socket.emit('receive-move', { count: roomStates[roomID] });
    } else {
      roomStates[roomID] = 0; // Initialise room if it's new
    }
    
    console.log(`User joined ${roomID}. Current room count: ${roomStates[roomID]}`);
  });

  socket.on('send-move', (data) => {
    // Update the "Source of Truth" on the server
    roomStates[data.room] = data.count;
    
    // Broadcast to others
    socket.to(data.room).emit('receive-move', data);
  });
});

// 5. Start the Server
// Tells the server to start listening for traffic on port 3000
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Sync Server running on http://localhost:${PORT}`);
});