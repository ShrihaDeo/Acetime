import { useEffect, useState } from 'react'
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
  const [roomError, setRoomError] = useState("")

  // Listen for 'room-full' event from the server to handle cases where a user tries to join a full room.
  useEffect(() => {
    socket.on('room-full', () => {
      setPage('room');
      setRoomError('That room is full. Try a different room ID.');
    });

    return () => socket.off('room-full');
  }, []);


  // This function is called when the user successfully joins a room. 
  // It sets the necessary state and notifies the server.
  const handleStartCall = (room, nickname) => {
    setRoomID(room);
    setNickname(nickname);
    setPage('call');
    // Clean the URL to avoid confusion when sharing room codes
    window.history.replaceState({}, '', '/');
    socket.emit('join-room', { room, nickname });
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