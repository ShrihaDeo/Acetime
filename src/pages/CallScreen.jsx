import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'
import Card from '../components/Card'

const backgrounds = [
  { bg: 'radial-gradient(circle at 30% 40%, #1a5c35 0%, #071a10 100%)', suits: ['♠', '♣'], accentColor: '#2ecc71' },
  { bg: 'radial-gradient(circle at 70% 60%, #5c1a1a 0%, #1a0707 100%)', suits: ['♥', '♦'], accentColor: '#e74c3c' },
  { bg: 'radial-gradient(circle at 50% 30%, #1a1060 0%, #020210 100%)', suits: ['♣', '♦'], accentColor: '#7c3aed' },
  { bg: 'radial-gradient(circle at 40% 70%, #4a2800 0%, #1a0e00 100%)', suits: ['♠', '♥'], accentColor: '#f0c040' },
]

function Avatar({ name, size = 80 }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  const colors = ['#c0392b', '#e67e22', '#2ecc71', '#3498db', '#7c3aed', '#1abc9c']
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, ${colors[colorIndex]}cc, ${colors[colorIndex]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: '700', color: 'white',
      userSelect: 'none', flexShrink: 0,
      fontFamily: "'Playfair Display', serif",
      boxShadow: `0 0 20px ${colors[colorIndex]}44`,
    }}>
      {initial}
    </div>
  )
}

function CallScreen({ socket, room, nickname, onLeave }) {
  const [syncStatus, setSyncStatus] = useState('Waiting for opponent...')
  const [bgIndex, setBgIndex] = useState(0)
  const [isOpponentJoined, setIsOpponentJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isOpponentCameraOff, setIsOpponentCameraOff] = useState(false)
  const [gameState, setGameState] = useState(null)
  const [nicknames, setNicknames] = useState({})
  const [copied, setCopied] = useState(false)

  const myStreamRef = useRef(null)
  const peerRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pendingPeerIdRef = useRef(null)

  // ── Socket: game + nicknames ──────────────────────────────────
  useEffect(() => {
    socket.on('game-init', (state) => { setGameState(state); setIsOpponentJoined(true); setSyncStatus('Game on!') })
    socket.on('receive-move', (data) => setSyncStatus(`${opponentNickname} played ${data.cardValue}${data.cardSuit}`))
    socket.on('nicknames-update', (data) => setNicknames(data))
    socket.on('opponent-disconnected', () => {
      setIsOpponentJoined(false)
      setSyncStatus('Opponent disconnected — waiting...')
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    })
    socket.on('camera-status', ({ isCameraOff: off }) => setIsOpponentCameraOff(off))
    return () => {
      socket.off('game-init'); socket.off('receive-move')
      socket.off('nicknames-update'); socket.off('opponent-disconnected')
      socket.off('camera-status')
    }
  }, [socket])

  // ── WebRTC ────────────────────────────────────────────────────
  useEffect(() => {
    const peer = new Peer()
    peerRef.current = peer

    const callPeer = (otherPeerId) => {
      if (!myStreamRef.current) { pendingPeerIdRef.current = otherPeerId; return }
      const call = peer.call(otherPeerId, myStreamRef.current)
      call.on('stream', (s) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s; setIsOpponentJoined(true); setSyncStatus('Connected!') })
    }

    peer.on('open', (id) => { socket.emit('peer-id', { room, peerId: id }) })
    socket.on('request-peer-id', () => { if (peer.id) socket.emit('peer-id', { room, peerId: peer.id }) })
    socket.on('peer-id', (id) => callPeer(id))

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        if (pendingPeerIdRef.current) { callPeer(pendingPeerIdRef.current); pendingPeerIdRef.current = null }
        peer.on('call', (call) => {
          call.answer(stream)
          call.on('stream', (s) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s; setIsOpponentJoined(true) })
        })
      })
      .catch(err => console.error('Camera error:', err))

    return () => {
      socket.off('peer-id'); socket.off('request-peer-id')
      if (myStreamRef.current) myStreamRef.current.getTracks().forEach(t => t.stop())
      peer.destroy()
    }
  }, [socket, room])

  // ── Helpers ───────────────────────────────────────────────────
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
  const handleCardClick = (card) => {
    setSyncStatus(`You played ${card.value}${card.suit}`)
    socket.emit('send-move', { room, cardValue: card.value, cardSuit: card.suit })
  }
  const copyRoom = () => {
    navigator.clipboard.writeText(room)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const myNickname = nicknames[socket.id] || nickname || 'You'
  const opponentNickname = Object.entries(nicknames).find(([id]) => id !== socket.id)?.[1] || 'Opponent'
  const accentColor = backgrounds[bgIndex].accentColor

  return (
    <div className="call-screen">

      {/* ── Left: Video Panel ── */}
      <div className="left-panel">

        {/* Room strip */}
        <div className="room-strip">
          <span className="room-strip-label">Room</span>
          <span className="room-strip-id">{room}</span>
          <button className="room-strip-copy" onClick={copyRoom}>
            {copied ? '✓ Copied' : 'Copy ID'}
          </button>
        </div>

        <div className="video-container">
          {/* Main video — opponent */}
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
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Camera off</span>
              </div>
            )}
            <video ref={remoteVideoRef} autoPlay playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: isOpponentCameraOff ? 'none' : 'block' }}
            />
            {isOpponentJoined && !isOpponentCameraOff && (
              <div className="name-tag">{opponentNickname}</div>
            )}
          </div>

          {/* Self view */}
          <div className="self-view">
            {isCameraOff ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#0d0b10' }}>
                <Avatar name={myNickname} size={40} />
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Camera off</span>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            )}
            <div className="name-tag" style={{ fontSize: '10px', padding: '2px 10px' }}>{myNickname} (you)</div>
          </div>
        </div>

        {/* Controls */}
        <div className="controls-bar">
          <div className="controls-left">
            <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : ''}`} title={isMuted ? 'Unmute' : 'Mute'}>
              <img src={Mute} alt="Mute" />
            </button>
            <button onClick={toggleCamera} className={`control-btn ${isCameraOff ? 'active' : ''}`} title={isCameraOff ? 'Camera on' : 'Camera off'}>
              <img src={VideoOff} alt="Camera" />
            </button>
          </div>
          <div className="controls-right">
            <button onClick={onLeave} className="control-btn end-call" title="Leave call">
              <img src={EndCall} alt="End Call" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Game Panel ── */}
      <div className="right-panel" style={{
        background: backgrounds[bgIndex].bg,
        backgroundImage: `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 0), ${backgrounds[bgIndex].bg}`,
        backgroundSize: '28px 28px, 100% 100%',
      }}>
        {/* Decorative suits */}
        <div className="table-suits">
          <span className="table-suit" style={{ color: accentColor }}>{backgrounds[bgIndex].suits[0]}</span>
          <span className="table-suit" style={{ color: accentColor }}>{backgrounds[bgIndex].suits[1]}</span>
        </div>

        {/* Corner decorations */}
        <div className="table-corners" style={{ color: accentColor }}>
          <span className="corner tl" /><span className="corner tr" />
          <span className="corner bl" /><span className="corner br" />
        </div>

        <div className="game-area">
          {/* Header row */}
          <div className="game-header">
            <div className="status-pill" style={{ color: accentColor }}>
              <span className="status-dot" />
              {syncStatus}
            </div>
            <button className="bg-cycle-btn" onClick={() => setBgIndex(p => (p + 1) % backgrounds.length)}>
              🎨 Theme
            </button>
          </div>

          {/* Opponent hand */}
          <div>
            <p className="hand-label">{opponentNickname}'s hand</p>
            <div className="opponent-hand">
              {gameState
                ? Object.keys(gameState.hands).filter(id => id !== socket.id).map(oppId =>
                    gameState.hands[oppId].map((_, i) => <div key={i} className="card card-back" />)
                  )
                : null}
            </div>
          </div>

          {/* Discard pile */}
          <div className="game-table">
            <p className="discard-label">Discard pile</p>
            {gameState
              ? <Card card={gameState.discard[gameState.discard.length - 1]} disabled={true} />
              : <div className="card-placeholder">Waiting</div>}
          </div>

          {/* Player hand */}
          <div>
            <p className="hand-label">Your hand</p>
            <div className="player-hand">
              {gameState && gameState.hands[socket.id]
                ? gameState.hands[socket.id].map(card =>
                    <Card key={card.id} card={card} onClick={() => handleCardClick(card)} />
                  )
                : <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Waiting for players...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen
