import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame } from './game.js'; // 1. Import teammate's logic

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" } // Allows all origins for testing
});

const roomStates = {}; 

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);
    
    const clients = io.sockets.adapter.rooms.get(cleanRoom);
    
    // 2. TRIGGER DEAL: When exactly 2 players are in the room
    if (clients.size === 2) {
        const playerIds = Array.from(clients);
        // Create the official game state using the teammate's logic
        roomStates[cleanRoom] = createGame(playerIds, "LastCard");
        
        // Send the initial game state to everyone in the room
        io.to(cleanRoom).emit('game-init', roomStates[cleanRoom]);
        console.log(`🎮 Game Started in Room: ${cleanRoom}`);
    }
  });

  socket.on("peer-id", (data) => {
    socket.to(data.room.trim().toLowerCase()).emit("peer-id", data.peerId);
  });

  socket.on('send-move', (data) => {
    const cleanRoom = data.room.trim().toLowerCase();
    // Later: update roomStates[cleanRoom] using playTurn()
    socket.to(cleanRoom).emit('receive-move', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Sync Server with Game Logic running on port ${PORT}`);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});