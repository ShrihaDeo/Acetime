import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerLastCardHandlers, startLastCard } from './lastCard.js';

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin:  'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const roomStates = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join Room
  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);

    const clients = io.sockets.adapter.rooms.get(cleanRoom);
    console.log(`User ${socket.id} joined room: ${cleanRoom}, count: ${clients.size}`);
    io.to(cleanRoom).emit('player-joined', { count: clients.size });
  });

  // Player clicks end call button — intentional leave
  socket.on('leave-room', (roomID) => {
    const cleanRoom = roomID?.trim().toLowerCase();
    if (!cleanRoom) return;

    console.log(`User ${socket.id} left room: ${cleanRoom}`);
    socket.leave(cleanRoom);

    // tell the other player
    io.to(cleanRoom).emit('opponent-left', {});

    // clean up game state so a new game can start fresh
    delete roomStates[cleanRoom];
  });

  // Video Signaling — passes peer id to the other player for WebRTC
  socket.on('peer-id', (data) => {
    socket.to(data.room.trim().toLowerCase()).emit('peer-id', data.peerId);
  });

  // Register all LastCard game events
  registerLastCardHandlers(io, socket, roomStates);

  // Generic game start
  socket.on('start-game', ({ room, selectedGame }) => {
    const cleanRoom = room.trim().toLowerCase();
    console.log('start-game received for room:', cleanRoom);
    if (selectedGame === 'LastCard') startLastCard(io, cleanRoom, roomStates);
  });

  // Handle disconnection — browser tab closed or connection lost
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // find which room this player was in and clean up
    for (const [roomID, roomData] of Object.entries(roomStates)) {
      if (roomData.state?.players?.includes(socket.id)) {
        // tell the remaining player their opponent left
        io.to(roomID).emit('opponent-left', {});

        // check if room is now empty
        const clients = io.sockets.adapter.rooms.get(roomID);
        const remaining = clients ? clients.size : 0;

        if (remaining === 0) {
          // both players gone — clean up
          delete roomStates[roomID];
          console.log(`Room ${roomID} cleaned up`);
        }
        break;
      }
    }
  });

}); // closes io.on('connection')

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});