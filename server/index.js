// server/index.js
// express is the framework that turn Node.js into a web server
import express from 'express';
// handles the raw connection between computers
import { createServer } from 'http';
// socket.io is the library that makes real-time communication easy
import { Server } from 'socket.io';
//Methods from lastCard.js
import { registerLastCardHandlers } from './lastCard.js';
import { startLastCard } from './lastCard.js';

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

const roomStates = {}; // This will hold the game state for each room 

// 2. Handle Connections
// Whenever a player opens the website, the function triggers
// Each player get a unique socket.id
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Join Room & State Rehydration
  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);
    
    // Send existing state to the person who just joined
    //if (roomStates[cleanRoom] !== undefined) {
    //  socket.emit('receive-move', { count: roomStates[cleanRoom] });
    //} else {
    //  roomStates[cleanRoom] = 0; 
    //}

    // Tell the room someone joined — client can trigger 'start-game' when count hits 2
    const clients = io.sockets.adapter.rooms.get(cleanRoom);
    io.to(cleanRoom).emit('player-joined', { count: clients.size });

    console.log(`User ${socket.id} joined room: ${cleanRoom}`);
  });

  // Register all LastCard game events
  registerLastCardHandlers(io, socket, roomStates);

  //// 2. Video Signaling (Room Isolated)
  //socket.on("peer-id", (data) => {
  //  // data = { room, peerId }
  //  socket.to(data.room.trim().toLowerCase()).emit("peer-id", data.peerId);
  //});
  


  //// 3. Game Move Sync (Room Isolated)
  //socket.on('send-move', (data) => {
  //  // data = { room, cardIndex }
  //  const cleanRoom = data.room.trim().toLowerCase();
  //  roomStates[cleanRoom] = data.cardIndex;
  //  socket.to(cleanRoom).emit('receive-move', data);
  //});

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });
});


// 5. Start the Server
// Tells the server to start listening for traffic on port 3000
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Sync Server running on http://localhost:${PORT}`);
});

//generic game start for future card game implementation
socket.on('start-game', ({ room, selectedGame }) => {
  const cleanRoom = room.trim().toLowerCase();
  if (selectedGame === 'LastCard') startLastCard(io, room, roomStates);
  // if (selectedGame === 'futuregame') startFutureGame(...)
});