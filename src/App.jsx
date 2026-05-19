import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'
import { io } from 'socket.io-client'

// Establish the single socket connection for the entire app
const socket = io('https://localhost:3000');

function App() {
  const [page, setPage] = useState('landing')
  const [roomID, setRoomID] = useState("")

  const handleStartCall = (room) => {
    setRoomID(room);
    setPage('call');
    socket.emit('join-room', room);
  }

  return (
    <>
      {/* Page 1: Landing */}
      {page === 'landing' && (
        <LandingPage onStart={() => setPage('room')} />
      )}
      
      {/* Page 2: Room Entry */}
      {page === 'room' && (
        <RoomPage onJoin={handleStartCall} />
      )}
      
      {/* Page 3: The actual Game/Video Screen */}
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