import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { io } from 'socket.io-client'

// Connect to the syncs Server
const socket = io('http://localhost:3000');

function App() {
  const [count, setCount] = useState(0)
  // Track the Room ID
  const [room, setRoom] = useState("");
  // Track if the player has joined a room
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    // This runs when the browser connects to the server
    socket.on('connect', () => {
      console.log('Connected to Sync Server with ID:', socket.id);
    });

    // Listen for updates from other players
    socket.on('receive-move', (data) => {
      console.log('Sync update received:', data);
      // We use data.count to update our screen with the new count from the other player
      setCount(data.count);
    });

    // Clean up the connection when the component unmounts
    return () => {
      socket.off('connect');
      socket.off('receive-move');
    };
  }, []);

  // Join a room when the player enters a room ID and clicks the button
  const joinRoom = () => {
    if (room) {
      const cleanRoom = room.trim().toLowerCase(); // Remove spaces and make lowercase
      setRoom(cleanRoom); // Update the room state with the cleaned room ID
      socket.emit('join-room', room);
      setJoined(true);
    } else {
      alert('Please enter a room ID to join'); // Simple validation to ensure a room ID is entered
    }
  }

  // Send update to others when button is clicked
  const handleCounterClick = () => {
    const nextCount = count + 1;
    setCount(nextCount); // We send the room so the server knows which room to broadcast to

    // EMIT the move to the server, which will then broadcast it to other players in the same room
    socket.emit('send-move', { room: room, count: nextCount });
  };

  return (
    <>
      
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>

        {/* --- LOBBY UI --- */}
        {!joined ? (
          <div className="lobby-container">
            <h1>AceTime Lobby</h1>
            <input 
              type="text" 
              placeholder="Enter Room ID (e.g. 123)" 
              style={{ padding: '10px', borderRadius: '5px' }}
              onChange={(e) => setRoom(e.target.value)} 
            />
            <button onClick={joinRoom} style={{ marginLeft: '10px' }}>Join Game</button>
          </div>
        ) : (
          /* --- GAME UI --- */
          <div>
            <h1>Room: {room}</h1>
            <p>Synchronization Active</p>
            <button type="button" className="counter" onClick={handleCounterClick}>
              Count is {count}
            </button>
          </div>
        )}
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <h2>Strand Progress</h2>
          <p>Current Status: {joined ? "In Room" : "In Lobby"}</p>
        </div>
      </section>
    </>
  )
}

export default App