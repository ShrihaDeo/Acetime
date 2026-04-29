// server/index.js
// express is the framework that turn Node.js into a web server
import express from 'express';
// handles the raw connection between computers
import { createServer } from 'http';
// socket.io is the library that makes real-time communication easy
import { Server } from 'socket.io';

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

  // 3. LISTEN for a move from a player
  socket.on('send-move', (data) => {
    console.log('Action received from client:', data);
    
    // 4. BROADCAST to all other players in the session
    // This tells everyone else to move the card on their screen
    socket.broadcast.emit('receive-move', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// 5. Start the Server
// Tells the server to start listening for traffic on port 3000
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Sync Server running on http://localhost:${PORT}`);
});