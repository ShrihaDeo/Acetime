import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CallScreen from './pages/CallScreen'
import './App.css'
import { io } from 'socket.io-client'

// Connect to the syncs Server
const socket = io('http://localhost:3000');

function App() {
  const [page, setPage] = useState('landing')

  return (
    <>
      {page === 'landing' && <LandingPage onStart={() => setPage('call')} />}
      {page === 'call' && <CallScreen onLeave={() => setPage('landing')} />}
    </>
  )
}

export default App