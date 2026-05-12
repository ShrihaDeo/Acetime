import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import RoomPage from './pages/RoomPage'
import './App.css'

function App() {
  const [page, setPage] = useState('landing')

  return (
    <>
      {/* Show the landing page until the user starts a call, then show the call screen */}
      {page === 'landing' && (
        <LandingPage onStart={() => setPage('room')} />
      )}
      {page === 'room' && (
        <RoomPage onJoin={handleStartCall} />
      )}
      {/* Pass the socket and room ID to the CallScreen so it can communicate with the server */}
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
