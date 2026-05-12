import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000');

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
      {page === 'landing' && (
        <LandingPage onStart={() => setPage('room')} />
      )}
      {page === 'room' && (
        <RoomPage onJoin={handleStartCall} />
      )}
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