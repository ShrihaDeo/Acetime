import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame } from './game.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, { cors: { origin: "*" } });


// A simple object to store the 'Source of Truth' for each room
const roomStates = {}; 

// 2. Handle ALL Connections in ONE block
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // --- JOIN ROOM & STATE REHYDRATION ---
  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);
    
    const clients = io.sockets.adapter.rooms.get(cleanRoom);

    // safety check
    const numClients = clients ? clients.size : 0;
    
    if (numClients === 2) {
        const playerIds = Array.from(clients);
        if (!roomStates[cleanRoom]) {
            roomStates[cleanRoom] = createGame(playerIds, "LastCard");
        }
        io.to(cleanRoom).emit('game-init', roomStates[cleanRoom]);
        
        // ✅ NEW: Tell everyone in the room to exchange Peer IDs again
        // This ensures the person who was waiting and the new person both get IDs
        io.to(cleanRoom).emit('request-peer-id'); 
        
        console.log(`Game Started & Peer IDs requested in: ${cleanRoom}`);
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
    console.log('User disconnected');
  });
});

// 3. START THE SERVER (ONLY ONCE!)
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`---------------------------------------`);
  console.log(`Server running on port ${PORT}`);
  console.log(`---------------------------------------`);
});