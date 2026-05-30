import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall  from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute     from '../assets/mute.svg'
import Card     from '../components/Card'


const backgrounds = [
  {
    bg: 'radial-gradient(circle at 30% 40%, #0d3d20 0%, #050f08 100%)',
    suits: ['♠', '♣'], accent: '#00ffb3',
  },
  {
    bg: 'radial-gradient(circle at 70% 30%, #3d0d2a 0%, #0f0508 100%)',
    suits: ['♥', '♦'], accent: '#ff3dac',
  },
  {
    bg: 'radial-gradient(circle at 40% 60%, #0d1a40 0%, #05080f 100%)',
    suits: ['♣', '♠'], accent: '#00d4ff',
  },
  {
    bg: 'radial-gradient(circle at 60% 40%, #2a0d3d 0%, #08050f 100%)',
    suits: ['♦', '♥'], accent: '#b44dff',
  },
  {
    bg: 'radial-gradient(circle at 50% 50%, #3d2a00 0%, #0f0a00 100%)',
    suits: ['♠', '♦'], accent: '#ffd700',
  },
]

// Game cards for the menu
const GAMES = [
  {
    id: 'lastcard',
    name: 'Last Card',
    description: 'Match suit or value. First to empty hand wins.',
    emoji: '🃏',
    color: 'rgba(180,77,255,0.3)',
    border: 'rgba(180,77,255,0.5)',
    available: true,
  },
  {
    id: 'highcard',
    name: 'High Card',
    description: 'Draw a card — highest wins the round.',
    emoji: '🎴',
    color: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.4)',
    available: false,
  },
  {
    id: 'snap',
    name: 'Snap',
    description: 'Be first to call snap when cards match.',
    emoji: '👋',
    color: 'rgba(255,61,172,0.2)',
    border: 'rgba(255,61,172,0.3)',
    available: false,
  },
]


function Avatar({ name, size = 72 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  const palettes = [
    ['#b44dff', '#7c00ff'],
    ['#ff3dac', '#c0006e'],
    ['#00d4ff', '#0088cc'],
    ['#00ffb3', '#00aa77'],
    ['#ffd700', '#cc9900'],
    ['#ff6b35', '#cc3300'],
  ]
  const [a, b] = palettes[name ? name.charCodeAt(0) % palettes.length : 0]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${a}, ${b})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: '800', color: 'white',
      userSelect: 'none', flexShrink: 0,
      fontFamily: "'Syne', sans-serif",
      boxShadow: `0 0 24px ${a}55, 0 0 60px ${a}22`,
    }}>
      {initial}
    </div>
  )
}

function CallScreen({ socket, room, nickname, onLeave }) {
  // Tracks whether the chat panel is visible or hidden. Start as false.
  const [chatOpen, setChatOpen]     = useState(false)
  // Tracks what the user is currently typing in the input box
  const [chatInput, setChatInput]   = useState('')
  // An array of all messages in the conversation. 
  // Starts with one one welcome message from the assistant.
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your game assistant. Ask me anything about the rules!"
    }
  ])
  // true while waiting for Gemini to respond
  // used to show the loading dots and disable the button
  const [chatLoading, setChatLoading] = useState(false)
  // ref attached to an invisible div at the bottom of the chat
  // used to auto scroll down when new messages arrive
  const chatEndRef = useRef(null)

  const [syncStatus, setSyncStatus] = useState('Waiting for opponent...')
  const [bgIndex, setBgIndex] = useState(0)
  const [isOpponentJoined, setIsOpponentJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isOpponentCameraOff, setIsOpponentCameraOff] = useState(false)
  const [gameState, setGameState] = useState(null)
  const [nicknames, setNicknames] = useState({})
  const [copied, setCopied] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [gameMode, setGameMode] = useState('call') // 'call' | 'menu' | 'lastcard'
  const [isHost, setIsHost] = useState(false)


  const myStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pendingPeerIdRef = useRef(null)

  const myNickname = nicknames[socket.id] || nickname || 'You'
  const opponentNickname = Object.entries(nicknames).find(([id]) => id !== socket.id)?.[1] || 'Opponent'
  const { accent } = backgrounds[bgIndex]

  // Sync local stream to the video element whenever the stream or camera toggle changes.
  // This runs after every render, ensuring srcObject is always set even after React
  // reconciles the video element (e.g. when opponent joins and causes a re-render).
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isCameraOff])

  // ── Socket listeners ──
  useEffect(() => {
    socket.on('game-init', (state) => {
      setGameState(state)
      setIsOpponentJoined(true)
      setSyncStatus('Game on!')
    })
    socket.on('game-state-update', (state) => {
      setGameState(state)
      setSyncStatus(state.log)
      if (state.winner) setSyncStatus(`${nicknames[state.winner] || 'Someone'} wins! `)
    })
    socket.on('receive-move', (data) => {
      setSyncStatus(`${opponentNickname} played ${data.cardValue}${data.cardSuit}`)
    })
    socket.on('nicknames-update', setNicknames)
    socket.on('opponent-disconnected', () => {
      setIsOpponentJoined(false)
      setSyncStatus('Opponent disconnected...')
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    })
    socket.on('camera-status', ({ isCameraOff: off }) => setIsOpponentCameraOff(off))
    socket.on('player-joined', ({ isHost: host }) => setIsHost(host))
    socket.on('game-selected', ({ game }) => {
      setGameMode(game)
      setGameState(null)
    }) 

    return () => {
      socket.off('game-init'); socket.off('game-state-update')
      socket.off('receive-move'); socket.off('nicknames-update') 
      socket.off('opponent-disconnected'); socket.off('camera-status')
      socket.off('player-joined'); socket.off('game-selected')
    }
  }, [socket, opponentNickname, nicknames])

  // -- WebRTC --
  useEffect(() => {
    const peer = new Peer(undefined, {
      config: {
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:standard.relay.metered.ca:80",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turn:standard.relay.metered.ca:80?transport=tcp",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turn:standard.relay.metered.ca:443",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turns:standard.relay.metered.ca:443?transport=tcp",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
      ]
    }
  })
  

  // Call a peer by their ID, sending them our video stream.
  // This is triggered when we learn the other peer's ID from the server.
  const callPeer = (otherId) => {
    if (!myStreamRef.current) { pendingPeerIdRef.current = otherId; return }
    console.log("Calling peer:", otherId)
    const call = peer.call(otherId, myStreamRef.current)
    call.on('stream', (s) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s
      setIsOpponentJoined(true)
      setSyncStatus('Connected!')
    })
  }

  peer.on('open', id => socket.emit('peer-id', { room, peerId: id }))
  socket.on('request-peer-id', () => { if (peer.id) socket.emit('peer-id', { room, peerId: peer.id }) })
  socket.on('peer-id', callPeer)

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        myStreamRef.current = stream
        setLocalStream(stream)  // triggers the sync useEffect above → camera shows immediately
        if (pendingPeerIdRef.current) { callPeer(pendingPeerIdRef.current); pendingPeerIdRef.current = null }
        peer.on('call', call => {
          call.answer(stream)
          call.on('stream', s => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s
            setIsOpponentJoined(true)
          })
        })
      })
      .catch(err => console.error('Camera error:', err))

    return () => {
      socket.off('peer-id'); socket.off('request-peer-id')
      if (myStreamRef.current) myStreamRef.current.getTracks().forEach(t => t.stop())
      peer.destroy()
    }
  }, [socket, room])

  // ── Helpers ──
  const toggleMute = () => {
    if (!myStreamRef.current) return
    myStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled)
    setIsMuted(p => !p)
  }

  const toggleCamera = () => {
    if (!myStreamRef.current) return
    const next = !isCameraOff
    myStreamRef.current.getVideoTracks().forEach(t => t.enabled = !next)
    setIsCameraOff(next)
    socket.emit('camera-status', { room, isCameraOff: next })
  }

  // When a card is clicked in the game UI, emit the move to the server if it's the player's turn.
  const handleCardClick = card => {
    if (!gameState) return
    if (gameState.players.indexOf(socket.id) !== gameState.currentIndex) {
      setSyncStatus("It's not your turn!")
      return
    }
    setSyncStatus(`You played ${card.value}${card.suit}`)
    socket.emit('send-move', { room, cardValue: card.value, cardSuit: card.suit })
  }

  // For games that allow drawing a card instead of playing
  // this function emits a draw action to the server.
  const handleDraw = () => {
    if (!gameState) return
    if (gameState.players.indexOf(socket.id) !== gameState.currIndex) {
      setSyncStatus("It's not your turn!")
      return
    }
    socket.emit('send-move', { room, action: 'draw' })
  }

  const copyRoom = () => {
    const link = `${window.location.origin}?room=${room}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  
  // ── GROQ AI Assistant ─────────────────────────────────────
  const askAI = async () => {
    if (!chatInput.trim() || chatLoading) return
  
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  
    try {
      // calls our server, not GROQ directly
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          playerNames: Object.values(nicknames).join(' vs '),
          handSize: gameState?.hands[socket.id]?.length ?? 7,
        })
      })
  
      if (response.status === 429) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: "I'm being rate limited — please wait 30 seconds and try again."
        }])
        return
      }
  
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
  
      const data = await response.json()
      const aiText = data.text ?? "Sorry, I couldn't get a response."
  
      setChatMessages(prev => [...prev, { role: 'assistant', text: aiText }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  
    } catch (err) {
      console.error('AI error:', err)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: "Something went wrong. Please try again."
      }])
    } finally {
      setChatLoading(false)
    }
  }

   // ── Shared camera strip (bottom of screen during game) ──────
   const CameraStrip = () => (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '12px',
      zIndex: 50,
    }}>
      {/* Friend's cam */}
      <div style={{
        width: '140px', height: '100px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.15)',
        background: '#05050a',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {isOpponentCameraOff ? (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
            <Avatar name={opponentNickname} size={36} />
          </div>
        ) : (
          <video ref={remoteVideoRef} autoPlay playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        )}
        <div style={{
          position: 'absolute', bottom: '4px', left: '6px',
          fontSize: '10px', color: 'white',
          background: 'rgba(0,0,0,0.6)', padding: '2px 6px',
          borderRadius: '6px', backdropFilter: 'blur(4px)',
        }}>
          {opponentNickname}
        </div>
      </div>

      {/* My cam */}
      <div style={{
        width: '140px', height: '100px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: `2px solid ${accent}44`,
        background: '#05050a',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {isCameraOff ? (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
            <Avatar name={myNickname} size={36} />
          </div>
        ) : (
          <video ref={localVideoRef} autoPlay muted playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
        )}
        <div style={{
          position: 'absolute', bottom: '4px', left: '6px',
          fontSize: '10px', color: 'white',
          background: 'rgba(0,0,0,0.6)', padding: '2px 6px',
          borderRadius: '6px', backdropFilter: 'blur(4px)',
        }}>
          {myNickname} (you)
        </div>
      </div>
    </div>
  )

  // ── Controls bar (always visible) ───────────────────────────
  const ControlsBar = () => (
    <div style={{
      position: 'absolute',
      bottom: '130px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '10px',
      zIndex: 50,
    }}>
      <button className={`control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
        <img src={Mute} alt="Mute" />
      </button>
      <button className={`control-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera}>
        <img src={VideoOff} alt="Camera" />
      </button>
      <button
        className={`control-btn ${chatOpen ? 'active' : ''}`}
        onClick={() => setChatOpen(p => !p)}
        style={{ fontSize: '18px', backgroundColor: chatOpen ? 'rgba(180,77,255,0.3)' : '' }}
      >
        🤖
      </button>
      <button className="control-btn end-call" onClick={onLeave}>
        <img src={EndCall} alt="End" />
      </button>
    </div>
  )

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#05050a', overflow: 'hidden' }}>

      {/* ── MODE: VIDEO CALL (no game) ── */}
      {gameMode === 'call' && (
        <>
          {/* Friend's face — full screen */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            {!isOpponentJoined ? (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '16px', background: '#08080f',
              }}>
                <div className="waiting-pulse" />
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Waiting for opponent...
                </p>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                  Share room code: <span style={{ color: 'var(--neon-blue)', letterSpacing: '2px' }}>{room}</span>
                </p>
              </div>
            ) : isOpponentCameraOff ? (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '16px', background: '#08080f',
              }}>
                <Avatar name={opponentNickname} size={100} />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  {opponentNickname} turned off camera
                </p>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>

          {/* My cam — bottom right corner */}
          <div style={{
            position: 'absolute',
            bottom: '140px',
            right: '20px',
            width: '160px',
            height: '120px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: `2px solid ${accent}66`,
            background: '#05050a',
            zIndex: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            {isCameraOff ? (
              <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', background:'#0d0b10' }}>
                <Avatar name={myNickname} size={40} />
                <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px' }}>Camera off</span>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay muted playsInline
                style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
            )}
            <div className="name-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
              {myNickname} (you)
            </div>
          </div>

          {/* Room strip — top left */}
          <div style={{
            position: 'absolute', top: '16px', left: '16px',
            zIndex: 20, display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div className="room-strip">
              <span className="room-strip-label">Room</span>
              <span className="room-strip-id">{room}</span>
              <button className={`room-strip-copy ${copied ? 'copied' : ''}`} onClick={copyRoom}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Controls — bottom centre */}
          <div style={{
            position: 'absolute', bottom: '24px', left: '50%',
            transform: 'translateX(-50%)', display: 'flex',
            gap: '10px', zIndex: 20,
          }}>
            <button className={`control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
              <img src={Mute} alt="Mute" />
            </button>
            <button className={`control-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera}>
              <img src={VideoOff} alt="Camera" />
            </button>
            <button
              className={`control-btn ${chatOpen ? 'active' : ''}`}
              onClick={() => setChatOpen(p => !p)}
              style={{ fontSize: '18px', backgroundColor: chatOpen ? 'rgba(180,77,255,0.3)' : '' }}
            >
              🤖
            </button>
            <button className="control-btn end-call" onClick={onLeave}>
              <img src={EndCall} alt="End" />
            </button>
          </div>

          {/* Game menu button — top right */}
          <button
            onClick={() => setGameMode('menu')}
            style={{
              position: 'absolute', top: '16px', right: '16px', zIndex: 20,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
              border: 'none', borderRadius: '980px',
              color: 'white', fontWeight: '600', fontSize: '13px',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              boxShadow: '0 0 20px rgba(180,77,255,0.4)',
              marginTop: 0,
            }}
          >
            🎮 Play Games
          </button>
        </>
      )}

      {/* ── MODE: GAME MENU ── */}
      {gameMode === 'menu' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(5,5,8,0.96)',
          backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '32px', padding: '40px',
        }}>
          {/* Back button */}
          <button
            onClick={() => setGameMode('call')}
            style={{
              position: 'absolute', top: '20px', left: '20px',
              padding: '8px 16px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px', color: 'rgba(255,255,255,0.6)',
              fontSize: '13px', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", marginTop: 0,
            }}
          >
            ← Back to call
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '32px', fontWeight: '800',
              color: 'white', marginBottom: '8px',
            }}>
              Choose a Game
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
              {isHost
                ? isOpponentJoined
                  ? 'Pick a game — your opponent will join automatically'
                  : 'Waiting for opponent before you can start...'
                : 'Waiting for host to pick a game...'}
            </p>
          </div>

          {/* Game cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            width: '100%',
            maxWidth: '720px',
          }}>
            {GAMES.map(game => (
              <div
                key={game.id}
                onClick={() => {
                  if (!game.available || !isHost || !isOpponentJoined) return
                  console.log('clicking game:', game.id)
                  socket.emit('game-selected', { room, game: game.id })
                }}
                style={{
                  borderRadius: '16px',
                  border: `1px solid ${game.available && isHost && isOpponentJoined ? game.border : 'rgba(255,255,255,0.07)'}`,
                  background: game.available && isHost && isOpponentJoined ? game.color : 'rgba(255,255,255,0.02)',
                  padding: '28px 20px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '14px',
                  cursor: game.available && isHost && isOpponentJoined ? 'pointer' : 'not-allowed',
                  opacity: game.available ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Big emoji as the "image" */}
                <div style={{
                  width: '80px', height: '80px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '44px',
                }}>
                  {game.emoji}
                </div>

                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: '16px', fontWeight: '700',
                    color: 'white', marginBottom: '6px',
                  }}>
                    {game.name}
                  </p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                    {game.description}
                  </p>
                </div>

                {!game.available && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    fontSize: '10px', color: 'rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.06)',
                    padding: '2px 8px', borderRadius: '10px',
                  }}>
                    Soon
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE: LAST CARD GAME ── */}
      {gameMode === 'lastcard' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          ...backgrounds[bgIndex],
          background: backgrounds[bgIndex].bg,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ${backgrounds[bgIndex].bg}`,
          backgroundSize: '28px 28px, 100% 100%',
        }}>
          {/* Decorative suits */}
          <div className="table-suits">
            <span className="table-suit" style={{ color: accent }}>{backgrounds[bgIndex].suits[0]}</span>
            <span className="table-suit" style={{ color: accent }}>{backgrounds[bgIndex].suits[1]}</span>
          </div>
          <span className="corner tl" style={{ color: accent }} />
          <span className="corner tr" style={{ color: accent }} />
          <span className="corner bl" style={{ color: accent }} />
          <span className="corner br" style={{ color: accent }} />

          {/* Game area — leaves space at bottom for cams */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            bottom: '140px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px 30px',
            boxSizing: 'border-box',
            zIndex: 1,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="status-pill" style={{ color: accent }}>
                <span className="status-dot" style={{ backgroundColor: accent }} />
                {gameState
                  ? gameState.players.indexOf(socket.id) === gameState.currIndex
                    ? '🟢 Your turn'
                    : `⏳ ${opponentNickname}'s turn`
                  : syncStatus}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setGameMode('menu')}
                  style={{
                    padding: '6px 14px', background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', borderRadius: '20px',
                    fontSize: '11px', cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif", marginTop: 0,
                  }}
                >
                  🎮 Games
                </button>
                <button className="bg-cycle-btn"
                  onClick={() => setBgIndex(p => (p + 1) % backgrounds.length)}>
                  🎨 Theme
                </button>
              </div>
            </div>

            {/* Opponent hand */}
            <div>
              <p className="hand-label">{opponentNickname}'s hand</p>
              <div className="opponent-hand">
                {gameState
                  ? Object.keys(gameState.hands)
                      .filter(id => id !== socket.id)
                      .map(oppId => gameState.hands[oppId].map((_, i) =>
                        <div key={i} className="card card-back" />
                      ))
                  : null}
              </div>
            </div>

            {/* Discard pile */}
            <div className="game-table">
              <p className="discard-label">Discard pile</p>
              {gameState
                ? <Card card={gameState.discard[gameState.discard.length - 1]} disabled={true} />
                : <div className="card-placeholder">Waiting…</div>}

              {gameState && gameState.players.indexOf(socket.id) === gameState.currIndex && (
                <button onClick={handleDraw} style={{
                  marginTop: '10px', padding: '8px 22px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white', borderRadius: '20px', fontSize: '12px',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginBottom: 0,
                }}>
                  Draw card
                </button>
              )}
            </div>

            {/* Your hand */}
            <div>
              <p className="hand-label">Your hand</p>
              <div className="player-hand">
                {gameState && gameState.hands[socket.id]
                  ? gameState.hands[socket.id].map(card =>
                      <Card key={card.id} card={card} onClick={() => handleCardClick(card)} />
                    )
                  : <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
                      Waiting for players...
                    </p>}
              </div>
            </div>
          </div>

          {/* Camera strip — bottom centre */}
          <div style={{
            position: 'absolute',
            bottom: '20px', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '12px', zIndex: 50,
          }}>
            {/* Friend cam */}
            <div style={{
              width: '150px', height: '110px',
              borderRadius: '12px', overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.15)',
              background: '#05050a', position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              {isOpponentCameraOff ? (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
                  <Avatar name={opponentNickname} size={36} />
                </div>
              ) : (
                <video ref={remoteVideoRef} autoPlay playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              )}
              <div style={{
                position:'absolute', bottom:'4px', left:'6px',
                fontSize:'10px', color:'white',
                background:'rgba(0,0,0,0.6)', padding:'2px 6px',
                borderRadius:'6px',
              }}>
                {opponentNickname}
              </div>
            </div>

            {/* My cam */}
            <div style={{
              width: '150px', height: '110px',
              borderRadius: '12px', overflow: 'hidden',
              border: `2px solid ${accent}55`,
              background: '#05050a', position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              {isCameraOff ? (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
                  <Avatar name={myNickname} size={36} />
                </div>
              ) : (
                <video ref={localVideoRef} autoPlay muted playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
              )}
              <div style={{
                position:'absolute', bottom:'4px', left:'6px',
                fontSize:'10px', color:'white',
                background:'rgba(0,0,0,0.6)', padding:'2px 6px',
                borderRadius:'6px',
              }}>
                {myNickname} (you)
              </div>
            </div>
          </div>

          {/* Controls in game */}
          <div style={{
            position: 'absolute', bottom: '140px', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '10px', zIndex: 50,
          }}>
            <button className={`control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
              <img src={Mute} alt="Mute" />
            </button>
            <button className={`control-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera}>
              <img src={VideoOff} alt="Camera" />
            </button>
            <button className="control-btn end-call" onClick={onLeave}>
              <img src={EndCall} alt="End" />
            </button>
          </div>
        </div>
      )}

      {/* ── AI CHAT PANEL (always available) ── */}
      {chatOpen && (
        <div style={{
          position: 'absolute', bottom: '90px', left: '20px',
          width: '320px', zIndex: 100,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(15,15,26,0.97)',
          border: '1px solid rgba(180,77,255,0.25)',
          borderRadius: '16px', overflow: 'hidden',
          maxHeight: '400px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>🤖</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--neon-purple)' }}>
              Game Assistant
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)',
              background: 'rgba(180,77,255,0.1)', padding: '2px 8px',
              borderRadius: '10px', border: '1px solid rgba(180,77,255,0.2)',
            }}>
              Powered by Groq
            </span>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontSize: '16px', padding: '0 4px', marginTop: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: '8px',
            minHeight: '160px', maxHeight: '260px',
          }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '7px 11px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))'
                    : 'rgba(255,255,255,0.06)',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  fontSize: '12px', lineHeight: '1.4', color: 'var(--text-primary)',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--neon-purple)',
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: '8px',
          }}>
            <input
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '7px 12px',
                color: 'var(--text-primary)', fontSize: '12px',
                outline: 'none', fontFamily: "'Inter', sans-serif",
              }}
              placeholder="Ask about the rules..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
              disabled={chatLoading}
            />
            <button
              onClick={askAI} disabled={chatLoading}
              style={{
                padding: '7px 12px',
                background: chatLoading ? 'rgba(180,77,255,0.2)' : 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '12px', cursor: chatLoading ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif", marginTop: 0, flexShrink: 0,
              }}
            >
              {chatLoading ? '...' : 'Ask'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CallScreen