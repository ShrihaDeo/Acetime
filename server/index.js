import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createGame, playTurn, drawCard, forceDraw } from './game.js';
import rateLimit from 'express-rate-limit';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// Validate required environment variables on startup
const REQUIRED_ENV = ['GROQ_API_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}
console.log('Environment variables validated')

const roomTimers = {} // tracks cleanup timers per room

function scheduleRoomCleanup(roomID) {
  // Cancel any existing timer for this room
  if (roomTimers[roomID]) {
    clearTimeout(roomTimers[roomID])
  }

  // Set a 10 minute timer — if nobody rejoins, clean up
  roomTimers[roomID] = setTimeout(() => {
    if (roomStates[roomID]) {
      delete roomStates[roomID]
      delete roomNicknames[roomID]
      delete roomTimers[roomID]
      console.log(`Room ${roomID} cleaned up after timeout`)
    }
  }, 10 * 60 * 1000) // 10 minutes
}

function cancelRoomCleanup(roomID) {
  if (roomTimers[roomID]) {
    clearTimeout(roomTimers[roomID])
    delete roomTimers[roomID]
  }
}

// replaces any socket IDs in the log string with their nicknames
function formatLog(log, roomID) {
  if (!log) return log
  for (const [id, name] of Object.entries(roomNicknames[roomID] || {})) {
    log = log.replace(id, name)
  }
  return log
}

// build a per-player view of the game state. we hide:
//  - the opponent's hand (only send a count)
//  - the actual deck array (only send a count)
// otherwise anyone could open devtools and read what cards are coming up
function sanitizeState(state, playerID, roomID) {
  const safeHands = {};
  for (const id of state.players) {
    safeHands[id] = id === playerID ? state.hands[id] : state.hands[id].length;
  }
  const { deck, ...rest } = state;
  return {
    ...rest,
    hands: safeHands,
    deckCount: deck.length,
    yourID: playerID,
    isYourTurn: state.players[state.currIndex] === playerID,
    log: formatLog(state.log, roomID),
  };
}

// Allow Express to read JSON request bodies
app.use(express.json())

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests - please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Groq proxy route
app.post('/api/ask', aiLimiter, async (req, res) => {
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
const roomNicknames = {};
const roomLastCard = {};   // who has called "Last Card!" this turn
const roomCallable = {};   // who currently can be called out (forgot to say it)

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ room, nickname }) => {
    const cleanRoom = room.trim().toLowerCase();

    // Cancel cleanup timer if someone is rejoining
    cancelRoomCleanup(cleanRoom)
    // Check capacity before joining
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

      // sends sanitized state to each player individually
      const clientsForInit = io.sockets.adapter.rooms.get(cleanRoom)
      for (const clientID of clientsForInit) {
        io.to(clientID).emit('game-init', sanitizeState(roomStates[cleanRoom], clientID, cleanRoom))
      }
      io.to(cleanRoom).emit('request-peer-id');

    } else if (roomStates[cleanRoom]) {
      socket.emit('game-init', sanitizeState(roomStates[cleanRoom], socket.id, cleanRoom));
    }

    console.log(`${nickname} (${socket.id}) joined room: ${cleanRoom}`);
  });

  socket.on("peer-id", (data) => {
    if (data.room) {
      socket.to(data.room.trim().toLowerCase()).emit("peer-id", data.peerId);
    }
  });

  // Validates move server-side using the game.js functions
  socket.on('send-move', (data) => {
    const cleanRoom = data.room.trim().toLowerCase()
    const state = roomStates[cleanRoom]

    if (!state) {
      socket.emit('game-error', 'No game found in this room')
      return
    }

    // Once the opponent acts, the call-out window closes
    if (roomCallable[cleanRoom] && roomCallable[cleanRoom] !== socket.id) {
      delete roomCallable[cleanRoom]
      io.to(cleanRoom).emit('callable-cleared')
    }

    const currentPlayerId = state.players[state.currIndex]
    if (socket.id !== currentPlayerId) {
      socket.emit('game-error', "It's not your turn!")
      return
    }

    // Player wants to draw
    if (data.action === 'draw') {
      const { newState, error } = drawCard(state, socket.id, 'LastCard')
      if (error) {
        socket.emit('game-error', error)
        return
      }
      // Drawing resets the player's Last Card call
      if (roomLastCard[cleanRoom]) roomLastCard[cleanRoom].delete(socket.id)
      roomStates[cleanRoom] = newState
      const clients = io.sockets.adapter.rooms.get(cleanRoom)
      for (const clientID of clients) {
        io.to(clientID).emit('game-state-update', sanitizeState(newState, clientID, cleanRoom))
      }
      return
    }

    // Player wants to play a card
    const { newState, error } = playTurn(state, 'LastCard', socket.id, data.cardId, data.chosenSuit)
    if (error) {
      socket.emit('game-error', error)
      return
    }

    // If they're down to 1 card and never called Last Card, they're now callable.
    // The opponent gets a window (until they act) to catch it.
    if (!newState.winner && newState.hands[socket.id]?.length === 1) {
      const calledLastCard = roomLastCard[cleanRoom]?.has(socket.id)
      if (!calledLastCard) {
        roomCallable[cleanRoom] = socket.id
        io.to(cleanRoom).emit('last-card-missed', { playerID: socket.id })
      }
      roomLastCard[cleanRoom]?.delete(socket.id)
    }

    roomStates[cleanRoom] = newState
    const clients = io.sockets.adapter.rooms.get(cleanRoom)
    for (const clientID of clients) {
      io.to(clientID).emit('game-state-update', sanitizeState(newState, clientID, cleanRoom))
    }
  })

  // Player declares "Last Card!" — only valid when holding exactly 2
  socket.on('call-last-card', ({ room }) => {
    const cleanRoom = room.trim().toLowerCase()
    const state = roomStates[cleanRoom]
    if (!state || !state.hands[socket.id]) return
    if (state.hands[socket.id].length === 2) {
      if (!roomLastCard[cleanRoom]) roomLastCard[cleanRoom] = new Set()
      roomLastCard[cleanRoom].add(socket.id)
      io.to(cleanRoom).emit('last-card-called', { playerID: socket.id })
    }
  })

  // someone tapped "Catch! they forgot Last Card" - opponent draws 2
  socket.on('call-out-opponent', ({ room }) => {
    const cleanRoom = room.trim().toLowerCase()
    const victim = roomCallable[cleanRoom]
    if (!victim || victim === socket.id) return

    const state = roomStates[cleanRoom]
    if (!state) return

    const penalised = forceDraw(state, victim, 2)
    roomStates[cleanRoom] = { ...penalised, log: 'Caught forgetting Last Card! +2 cards' }
    delete roomCallable[cleanRoom]

    io.to(cleanRoom).emit('called-out', { caller: socket.id, victim })
    const clients = io.sockets.adapter.rooms.get(cleanRoom)
    for (const clientID of clients) {
      io.to(clientID).emit('game-state-update', sanitizeState(roomStates[cleanRoom], clientID, cleanRoom))
    }
  })


  // Clean up room data after both players leave
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomID, state] of Object.entries(roomStates)) {
      if (state.players.includes(socket.id)) {
        socket.to(roomID).emit('opponent-disconnected');

        const clients = io.sockets.adapter.rooms.get(roomID);
        const remaining = clients ? clients.size : 0;

        if (remaining === 0) {
          // Room empty — schedule cleanup after 10 minutes
          // (gives players a chance to rejoin)
          scheduleRoomCleanup(roomID)
          console.log(`Room ${roomID} scheduled for cleanup`)
        }
        break;
      }
    }
  });


  // Handle camera status updates
  socket.on('camera-status', (data) => {
    socket.to(data.room.trim().toLowerCase()).emit('camera-status', data);
  });

  // someone picked a game from the menu. if the previous game already ended we
  // build a fresh game so "Play again" actually deals new hands
  socket.on('game-selected', (data) => {
    const cleanRoom = data.room.trim().toLowerCase();
    io.to(cleanRoom).emit('game-selected', { game: data.game });

    const existing = roomStates[cleanRoom];
    if (existing?.winner) {
      const playerIds = Array.from(io.sockets.adapter.rooms.get(cleanRoom) || []);
      roomStates[cleanRoom] = createGame(playerIds, 'LastCard');
      delete roomLastCard[cleanRoom];
      delete roomCallable[cleanRoom];
    }

    const state = roomStates[cleanRoom];
    if (state) {
      const clients = io.sockets.adapter.rooms.get(cleanRoom);
      for (const clientID of clients) {
        io.to(clientID).emit('game-init', sanitizeState(state, clientID, cleanRoom));
      }
    }
  });

});

process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully')
  io.emit('server-restart', {
    message: 'Server is restarting. Please refresh in a moment.'
  })
  setTimeout(() => {
    io.close()
    httpServer.close(() => {
      console.log('Server closed cleanly')
      process.exit(0)
    })
  }, 3000)
})


// 3. START THE SERVER (ONLY ONCE!)
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`---------------------------------------`);
  console.log(`Server running on port ${PORT}`);
  console.log(`---------------------------------------`);
});