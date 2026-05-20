import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'
import { io } from 'socket.io-client'

const socket = io(window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://acetime-backend.onrender.com' 
);

function App() {
  const [page, setPage] = useState('landing')
  const [roomID, setRoomID] = useState("")
  const [nickname, setNickname] = useState("") 

  const handleStartCall = (room) => {
    setRoomID(room);
    setNickname(name);
    setPage('call');
    socket.emit('join-room', { room, nickname: name });
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
          nickname={nickname}
          onLeave={() => setPage('landing')} 
        />
      )}
    </>
  )
}

export default App