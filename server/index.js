import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame } from './game.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, { cors: { origin: "*" } });


// A simple object to store the 'Source of Truth' for each room
const roomStates = {}; 

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomID) => {
    const cleanRoom = roomID.trim().toLowerCase();
    socket.join(cleanRoom);

    const clients = io.sockets.adapter.rooms.get(cleanRoom);
    const numClients = clients ? clients.size : 0;

    if (numClients === 2) {
      const playerIds = Array.from(clients);

      if (!roomStates[cleanRoom]) {
        // Fresh game — both players are new
        roomStates[cleanRoom] = createGame(playerIds, "LastCard");
      } else {
        // Room already has a game — someone rejoined with a new socket ID
        // Find which old player ID is no longer connected and remap it
        const existingState = roomStates[cleanRoom];
        const oldPlayerIds = existingState.players;

        // Figure out which old ID is the "ghost" (not in current clients)
        const ghostId = oldPlayerIds.find(id => !playerIds.includes(id));
        const newId = playerIds.find(id => !oldPlayerIds.includes(id));

        if (ghostId && newId) {
          console.log(`Remapping player ${ghostId} → ${newId}`);

          // Remap the hand
          const newHands = { ...existingState.hands };
          newHands[newId] = newHands[ghostId];
          delete newHands[ghostId];

          // Remap the players array
          const newPlayers = oldPlayerIds.map(id => id === ghostId ? newId : id);

          roomStates[cleanRoom] = {
            ...existingState,
            players: newPlayers,
            hands: newHands,
          };
        }
      }

      io.to(cleanRoom).emit('game-init', roomStates[cleanRoom]);
      io.to(cleanRoom).emit('request-peer-id');
      console.log(`Game updated and peer IDs requested in: ${cleanRoom}`);

    } else if (roomStates[cleanRoom]) {
      // First player back in an existing room — just rehydrate their state
      socket.emit('game-init', roomStates[cleanRoom]);
    }

    console.log(`User ${socket.id} joined room: ${cleanRoom}`);
  });

  socket.on("peer-id", (data) => {
    if (data.room) {
      socket.to(data.room.trim().toLowerCase()).emit("peer-id", data.peerId);
    }
  });

  socket.on('send-move', (data) => {
    const cleanRoom = data.room.trim().toLowerCase();
    if (roomStates[cleanRoom]) {
      roomStates[cleanRoom].log = `${socket.id} played a card`;
    }
    socket.to(cleanRoom).emit('receive-move', data);
  });

  // Clean up when a player disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Tell everyone in the same room their opponent left
    for (const [roomID, state] of Object.entries(roomStates)) {
      if (state.players.includes(socket.id)) {
        socket.to(roomID).emit('opponent-disconnected');
        break;
      }
    }
  });
});

// 3. START THE SERVER (ONLY ONCE!)
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`---------------------------------------`);
  console.log(`Server running on port ${PORT}`);
  console.log(`---------------------------------------`);
});