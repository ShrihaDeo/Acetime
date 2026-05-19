import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame } from './game.js';

const app = express();
const httpServer = createServer(app);

// 1. Initialise Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    // Allow both local development and your Render frontend
    origin: ["http://localhost:5173", "https://acetime.onrender.com"], 
    methods: ["GET", "POST"]
  }
});

// A simple object to store the 'Source of Truth' for each room
const roomStates = {}; 

// 2. Handle ALL Connections in ONE block
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // --- JOIN ROOM & STATE REHYDRATION ---
  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);
    
    // Check if room is full (2 players)
    const clients = io.sockets.adapter.rooms.get(cleanRoom);
    
    if (clients.size === 2) {
        const playerIds = Array.from(clients);
        // Create the official game state if it doesn't exist
        if (!roomStates[cleanRoom]) {
            roomStates[cleanRoom] = createGame(playerIds, "LastCard");
        }
        // Send the initial game state to everyone in the room
        io.to(cleanRoom).emit('game-init', roomStates[cleanRoom]);
        console.log(`🎮 Game Started in Room: ${cleanRoom}`);
    } else if (roomStates[cleanRoom]) {
        // If someone refreshes/rejoins, send them the current state
        socket.emit('game-init', roomStates[cleanRoom]);
    }
    
    console.log(`User ${socket.id} joined room: ${cleanRoom}`);
  });

  // --- VIDEO SIGNALING ---
  socket.on("peer-id", (data) => {
    // data = { room, peerId }
    if (data.room) {
        socket.to(data.room.trim().toLowerCase()).emit("peer-id", data.peerId);
    }
  });

  // --- GAME MOVE SYNC ---
  socket.on('send-move', (data) => {
    // data = { room, cardValue, cardSuit }
    const cleanRoom = data.room.trim().toLowerCase();
    
    // update state (you can expand this later with playTurn logic)
    if (roomStates[cleanRoom]) {
        roomStates[cleanRoom].log = `${socket.id} played a card`;
    }
    
    socket.to(cleanRoom).emit('receive-move', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// 3. START THE SERVER (ONLY ONCE!)
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`---------------------------------------`);
  console.log(`🚀 Master Server running on port ${PORT}`);
  console.log(`---------------------------------------`);
});