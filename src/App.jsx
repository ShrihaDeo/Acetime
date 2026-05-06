import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import './App.css'
import { io } from 'socket.io-client'

// Connect to the syncs Server
const socket = io('http://localhost:3000');

function App() {
  const [page, setPage] = useState('landing')
  const [roomID, setRoomID] = useState("")

  const handleStartCall = (room) => {
    console.log("Joining room:", room); // Log the room ID to verify it's being passed correctly
    setRoomID(room);
    setPage('call'); // Switch to the call screen
    socket.emit('join-room', room); // Join the specified room on the server
  }

  return (
    <>
      // Show the landing page until the user starts a call, then show the call screen
      {page === 'landing' && (
        <LandingPage onStart={handleStartCall} />
      )}
      // Pass the socket and room ID to the CallScreen so it can communicate with the server
      {page === 'call' && (
        <CallScreen 
          socket={socket} 
          room={roomID} 
          onLeave={() => setPage('landing')} 
        />
      )}
    </>
  )
}

export default App