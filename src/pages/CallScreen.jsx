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
      text: "Hi! I'm your game assistant 🃏 Ask me anything about the rules!"
    }
  ])
  // true while waiting for Gemini to respond
  // used to show the loading dots and disable the button
  const [chatLoading, setChatLoading] = useState(false)
  // ref attached to an invisible div at the bottom of the chat
  // used to auto scroll down when new messages arrive
  const chatEndRef = useRef(null)

  const [syncStatus, setSyncStatus]             = useState('Waiting for opponent...')
  const [bgIndex, setBgIndex]                   = useState(0)
  const [isOpponentJoined, setIsOpponentJoined] = useState(false)
  const [isMuted, setIsMuted]                   = useState(false)
  const [isCameraOff, setIsCameraOff]           = useState(false)
  const [isOpponentCameraOff, setIsOpponentCameraOff] = useState(false)
  const [gameState, setGameState]               = useState(null)
  const [nicknames, setNicknames]               = useState({})
  const [copied, setCopied]                     = useState(false)
  const [localStream, setLocalStream]           = useState(null)

  const myStreamRef      = useRef(null)
  const localVideoRef    = useRef(null)
  const remoteVideoRef   = useRef(null)
  const pendingPeerIdRef = useRef(null)

  const myNickname       = nicknames[socket.id] || nickname || 'You'
  const opponentNickname = Object.entries(nicknames).find(([id]) => id !== socket.id)?.[1] || 'Opponent'
  const { accent }       = backgrounds[bgIndex]

  // Sync local stream to the video element whenever the stream or camera toggle changes.
  // This runs after every render, ensuring srcObject is always set even after React
  // reconciles the video element (e.g. when opponent joins and causes a re-render).
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isCameraOff])

  // ── Socket listeners ────────────────────────────────────────
  useEffect(() => {
    socket.on('game-init', (state) => {
      setGameState(state)
      setIsOpponentJoined(true)
      setSyncStatus('Game on! 🎮')
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

    return () => {
      socket.off('game-init'); socket.off('receive-move')
      socket.off('nicknames-update'); socket.off('opponent-disconnected')
      socket.off('camera-status')
    }
  }, [socket, opponentNickname])

  // ── WebRTC ──────────────────────────────────────────────────
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
      etSyncStatus('Connected! ✨')
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

  // ── Helpers ─────────────────────────────────────────────────
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

  const handleCardClick = card => {
    setSyncStatus(`You played ${card.value}${card.suit}`)
    socket.emit('send-move', { room, cardValue: card.value, cardSuit: card.suit })
  }

  const copyRoom = () => {
    const link = `${window.location.origin}?room=${room}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const el = document.createElement('textarea')
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  
  // ── Gemini AI Assistant ─────────────────────────────────────
  const askAI = async () => {
    if (!chatInput.trim() || chatLoading) return
  
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
  
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  
    try {
      // ← calls YOUR server, not Gemini directly
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
          text: "I'm being rate limited — please wait 30 seconds and try again ⏳"
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

  return (
    <div className="call-screen">
      {/* ── LEFT: Video panel ── */}
      <div className="left-panel">
        <div className="room-strip">
          <span className="room-strip-label">Room</span>
          <span className="room-strip-id">{room}</span>
          <button
            className={`room-strip-copy ${copied ? 'copied' : ''}`}
            onClick={copyRoom}
          >
            {copied ? '✓ Copied!' : 'Copy ID'}
          </button>
        </div>

        <div className="video-container">
          <div className="main-video">
            {!isOpponentJoined && (
              <div className="video-placeholder">
                <div className="waiting-pulse" />
                Waiting for opponent...
              </div>
            )}
            {isOpponentJoined && isOpponentCameraOff && (
              <div className="video-placeholder">
                <Avatar name={opponentNickname} size={72} />
                <span style={{ fontSize: '12px', marginTop: '10px' }}>Camera off</span>
              </div>
            )}
            <video
              ref={remoteVideoRef} autoPlay playsInline
              style={{ width:'100%', height:'100%', objectFit:'cover',
                display: (isOpponentJoined && !isOpponentCameraOff) ? 'block' : 'none' }}
            />
            {isOpponentJoined && !isOpponentCameraOff && (
              <div className="name-tag">{opponentNickname}</div>
            )}
          </div>

          <div className="self-view">
            {isCameraOff ? (
              <div style={{ width:'100%', height:'100%', display:'flex',
                flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:'6px', background:'#05050a' }}>
                <Avatar name={myNickname} size={38} />
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'10px' }}>Camera off</span>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay muted playsInline
                style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}
              />
            )}
            <div className="name-tag" style={{ fontSize:'10px', padding:'2px 10px' }}>
              {myNickname} (you)
            </div>
          </div>
        </div>

        {/* Chat panel*/}
        {chatOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(15,15,26,0.95)',
            border: '1px solid rgba(180,77,255,0.25)',
            borderRadius: '12px',
            overflow: 'hidden',
            flexShrink: 0,
            maxHeight: '260px',
          }}>

            {/* Header */}
            <div style={{
              padding: '8px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>🤖</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--neon-purple)' }}>
                Game Assistant
              </span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '10px',
                color: 'var(--text-muted)',
                background: 'rgba(180,77,255,0.1)',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid rgba(180,77,255,0.2)',
              }}>
                Powered by Gemini
              </span>
            </div>

            {/* Messages list */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: '120px',
              maxHeight: '160px',
            }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '7px 11px',
                    borderRadius: msg.role === 'user'
                      ? '12px 12px 2px 12px'
                      : '12px 12px 12px 2px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))'
                      : 'rgba(255,255,255,0.06)',
                    border: msg.role === 'assistant'
                      ? '1px solid rgba(255,255,255,0.08)'
                      : 'none',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    color: 'var(--text-primary)',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Loading dots — only show while waiting for Gemini */}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--neon-purple)',
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}

              {/* Invisible div at the bottom — scrolled into view when new messages arrive */}
              <div ref={chatEndRef} />
            </div>

            {/* Input row */}
            <div style={{
              padding: '8px 10px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: '8px',
            }}>
              <input
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif",
                }}
                placeholder="Ask about the rules..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI()}
                disabled={chatLoading}
              />
              <button
                onClick={askAI}
                disabled={chatLoading}
                style={{
                  padding: '7px 12px',
                  background: chatLoading
                    ? 'rgba(180,77,255,0.2)'
                    : 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: chatLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  marginTop: 0,
                  flexShrink: 0,
                }}
              >
                {chatLoading ? '...' : 'Ask'}
              </button>
            </div>
          </div>
        )}

        <div className="controls-bar">
          <div className="controls-left">
            <button
              className={`control-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
              style={{ backgroundColor: isMuted ? '#ff3b30' : '#3a3a3c' }}
            >
              <img src={Mute} alt="Mute" />
            </button>
            <button
              className={`control-btn ${isCameraOff ? 'active' : ''}`}
              onClick={toggleCamera} title="Toggle camera"
              style={{ backgroundColor: isCameraOff ? '#ff3b30' : '#3a3a3c' }}
            >
              <img src={VideoOff} alt="Camera" />
            </button>

            {/* AI button*/} 
            <button
            className={`control-btn ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen(p => !p)}
            title="AI Assistant"
            style={{
              fontSize: '18px',
              backgroundColor: chatOpen ? 'rgba(180,77,255,0.3)' : ''
            }} 
            >
              🤖
            </button>
          </div>

          <div className="controls-right">
            <button className="control-btn end-call" onClick={onLeave} title="Leave">
              <img src={EndCall} alt="End call" />
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Game panel ── */}
      <div
        className="right-panel"
        style={{
          background: backgrounds[bgIndex].bg,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ${backgrounds[bgIndex].bg}`,
          backgroundSize: '28px 28px, 100% 100%',
        }}
      >
        <div className="table-suits">
          <span className="table-suit" style={{ color: accent }}>{backgrounds[bgIndex].suits[0]}</span>
          <span className="table-suit" style={{ color: accent }}>{backgrounds[bgIndex].suits[1]}</span>
        </div>

        <span className="corner tl" style={{ color: accent }} />
        <span className="corner tr" style={{ color: accent }} />
        <span className="corner bl" style={{ color: accent }} />
        <span className="corner br" style={{ color: accent }} />

        <div className="game-area">
          <div className="game-header">
            <div className="status-pill" style={{ color: accent }}>
              <span className="status-dot" style={{ backgroundColor: accent }} />
              {syncStatus}
            </div>
            <button
              className="bg-cycle-btn"
              onClick={() => setBgIndex(p => (p + 1) % backgrounds.length)}
            >
              🎨 Theme
            </button>
          </div>

          <div>
            <p className="hand-label">{opponentNickname}'s hand</p>
            <div className="opponent-hand">
              {gameState
                ? Object.keys(gameState.hands)
                    .filter(id => id !== socket.id)
                    .map(oppId =>
                      gameState.hands[oppId].map((_, i) =>
                        <div key={i} className="card card-back" />
                      )
                    )
                : null}
            </div>
          </div>

          <div className="game-table">
            <p className="discard-label">Discard pile</p>
            {gameState
              ? <Card card={gameState.discard[gameState.discard.length - 1]} disabled={true} />
              : <div className="card-placeholder">Waiting…</div>}
          </div>

          <div>
            <p className="hand-label">Your hand</p>
            <div className="player-hand">
              {gameState && gameState.hands[socket.id]
                ? gameState.hands[socket.id].map(card =>
                    <Card key={card.id} card={card} onClick={() => handleCardClick(card)} />
                  )
                : <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'13px' }}>Waiting for players...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen
