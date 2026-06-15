import { useEffect, useState, useRef } from 'react'
import bgMusic from './assets/8bit loop song.wav'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'
import { io } from 'socket.io-client'

const isLocal = window.location.hostname === 'localhost';
const socket = io(isLocal ? 'http://localhost:3000' : 'https://acetime-backend.onrender.com', {
  transports: ['websocket'],
  upgrade: false
});

// Read ?room= once at module load — used to pre-fill the room field when a
// friend clicks a shared link
const urlRoom = (() => {
  try { return new URLSearchParams(window.location.search).get('room') || '' }
  catch { return '' }
})()

function App() {
  const [page, setPage] = useState(urlRoom ? 'room' : 'landing')
  const [roomID, setRoomID] = useState("")
  const [nickname, setNickname] = useState("")
  const [roomError, setRoomError] = useState("")
  const [isMusicMuted, setIsMusicMuted] = useState(false)


  // Listen for 'room-full' event from the server to handle cases where a user tries to join a full room.
  useEffect(() => {
    socket.on('room-full', () => {
      setPage('room');
      setRoomError('That room is full. Try a different room ID.');
    });

    return () => socket.off('room-full');
  }, []);

  const bgMusicRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(bgMusic)
    audio.loop = true
    audio.volume = 0.3
    bgMusicRef.current = audio

    // browsers block autoplay until the user interacts. try once for the case
    // where they already did (e.g. HMR reload), otherwise start on first click.
    const tryPlay = () => audio.play().catch(() => {})
    tryPlay()
    const onGesture = () => {
      tryPlay()
      window.removeEventListener('click', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('click', onGesture)
    window.addEventListener('keydown', onGesture)

    return () => {
      audio.pause()
      audio.currentTime = 0
      window.removeEventListener('click', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])

  const toggleMusic = () => {
    if (bgMusicRef.current) {
      bgMusicRef.current.muted = !bgMusicRef.current.muted
      setIsMusicMuted(prev => !prev)
    }
  }


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
        <RoomPage
          onJoin={handleStartCall}
          defaultRoom={urlRoom}
          serverError={roomError}
          onClearError={() => setRoomError("")}
        />
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

      <button
        className="ctrl-btn"
        onClick={toggleMusic}
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, width: 48, height: 48 }}
        title={isMusicMuted ? 'Unmute music' : 'Mute music'}
      >
        {isMusicMuted ? '🔇' : '🎵'}
      </button>
    </>
  )
}

export default App