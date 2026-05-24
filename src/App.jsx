import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'
import { io } from 'socket.io-client'

// create socket once for the whole app
const socket = io('http://localhost:3000');

// listen for player-joined at the top level so it never misses the event
socket.on('player-joined', ({ count }) => {
  console.log('player-joined, count:', count);
  if (count === 2) {
    console.log('emitting start-game');
    socket.emit('start-game', { room: socket.currentRoom, selectedGame: 'LastCard' });
  }
});

function App() {
  const [page, setPage] = useState('landing');
  const [roomID, setRoomID] = useState('');

  const handleStartCall = (room) => {
    // store room on socket so the player-joined listener above can use it
    socket.currentRoom = room;
    socket.emit('join-room', room);
    setRoomID(room);
    setPage('call');
  };

  // properly handles the leave so theres a indication that the player room but not disconnected 
  const handleLeave = () => {
    socket.emit('leave-room', socket.currentRoom);
    socket.currentRoom = null;
    setPage('landing');
    setRoomID('');
  };

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

      {/* Page 3: Game/Video Screen */}
      {page === 'call' && (
        <CallScreen
          socket={socket}
          room={roomID}
          onLeave={handleLeave}  
        />
      )}
    </>
  );
}

export default App;