import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame } from './game.js';
import rateLimit from 'express-rate-limit';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, { cors: { origin: "*" } });

// Allow Express to read JSON request bodies
app.use(express.json())

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, 
  message: { error: 'Too many requests - please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Gemini proxy route
  app.post('/api/ask', async (req, res) => {
  const { question, playerNames, handSize } = req.body

  if (!question || question.trim() === '') {
    return res.status(400).json({ error: 'Question is required' })
  }

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are a helpful game assistant for LastCard (like Uno).
              Rules: match suit or value, Jacks are wild, 2s force draw 2, empty hand wins.
              Players: ${playerNames}. Cards in hand: ${handSize}.
              Answer briefly in 2-3 sentences.`
            },
            {
              role: 'user',
              content: question
            }
          ],
          max_tokens: 150,
          temperature: 0.7,
        })
      }
    )
  
    if (!response.ok) {
      const err = await response.json()
      console.error('Groq error:', err)
      return res.status(response.status).json({ error: err.error?.message ?? 'Groq request failed' })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? "Sorry, couldn't get a response."
    res.json({ text })

  } catch (err) {
    console.error('Server error calling Groq:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// A simple object to store the 'Source of Truth' for each room
const roomStates = {}; 
const roomNicknames = {}; // Store nicknames for each player in each room

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ room, nickname }) => {
    const cleanRoom = room.trim().toLowerCase();
    // Check capacity BEFORE joining
    const existingClients = io.sockets.adapter.rooms.get(cleanRoom);
    const currentSize = existingClients ? existingClients.size : 0;

    if (currentSize >= 2) {
      socket.emit('room-full');
      return; // Don't let them join
    }
    
    socket.join(cleanRoom);
    const isHost = currentSize === 0;
    socket.emit('player-joined', { isHost })

    // Store nickname
    if (!roomNicknames[cleanRoom]) roomNicknames[cleanRoom] = {};
    roomNicknames[cleanRoom][socket.id] = nickname || 'Player';

    // Broadcast updated nicknames to everyone in the room
    io.to(cleanRoom).emit('nicknames-update', roomNicknames[cleanRoom]);

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
          // Remap nickname too
          if (roomNicknames[cleanRoom][ghostId]) {
            roomNicknames[cleanRoom][newId] = roomNicknames[cleanRoom][ghostId];
            delete roomNicknames[cleanRoom][ghostId];
          }
        }
      }

      io.to(cleanRoom).emit('game-init', roomStates[cleanRoom]);
      io.to(cleanRoom).emit('request-peer-id');

    } else if (roomStates[cleanRoom]) {
      socket.emit('game-init', roomStates[cleanRoom]);
    }

    console.log(`${nickname} (${socket.id}) joined room: ${cleanRoom}`);
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

  // Clean up room data after both players leave
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomID, state] of Object.entries(roomStates)) {
      if (state.players.includes(socket.id)) {
        socket.to(roomID).emit('opponent-disconnected');
  
        // Check if room is now empty before deleting
        const clients = io.sockets.adapter.rooms.get(roomID);
        const remaining = clients ? clients.size : 0;
  
        if (remaining === 0) {
          // Both players gone — clean up completely
          delete roomStates[roomID];
          delete roomNicknames[roomID];
          console.log(`Room ${roomID} cleaned up`);
        }
        break;
      }
    }
  });
  

  // Handle camera status updates
  socket.on('camera-status', (data) => {
    socket.to(data.room.trim().toLowerCase()).emit('camera-status', data);
  });

  // Handl game selection
  socket.on('game-selected', (data) => {
    const cleanRoom = data.room.trim().toLowerCase();
    io.to(cleanRoom).emit('game-selected', { game: data.game })
  })

});



// 3. START THE SERVER (ONLY ONCE!)
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`---------------------------------------`);
  console.log(`Server running on port ${PORT}`);
  console.log(`---------------------------------------`);
});