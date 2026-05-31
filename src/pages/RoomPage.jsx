import { useState } from 'react'

// This component renders the room entry page where users can input their nickname and a room ID to join or create a game room. 
// It also handles basic validation and displays error messages.
function RoomPage({ onJoin, defaultRoom = '', serverError = '', onClearError}) {
  const [room, setRoom]         = useState(defaultRoom)
  const [nickname, setNickname] = useState('')
  const [error, setError]       = useState('')

  const handleJoin = () => {
    if (!nickname.trim())      { setError('Please enter a nickname.'); return }
    if (!room.trim())          { setError('Please enter a room ID.');  return }
    if (!/^\d+$/.test(room))   { setError('Room ID must be numbers only.'); return }
    setError('')
    onJoin(room, nickname.trim())
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="mesh-bg" />
      <div className="grid-overlay" />
      <div className="noise" />

      <div className="suits-bg">
        <span className="suit">♥</span>
        <span className="suit">♠</span>
        <span className="suit">♦</span>
        <span className="suit">♣</span>
      </div>

      <div className="room-page">
        <div className="glass-card room-card">

          {/* Header */}
          <div className="room-card-header">
            <span className="room-card-icon">🃏</span>
            <h2 className="room-card-title">Join a Room</h2>
            <p className="room-card-sub">Enter your name and a room code to start playing</p>
          </div>

          <hr className="neon-divider" />

          {/* local error or server error */}
          {(error || serverError) && (
            <p className="error-msg">⚠ {error || serverError}</p>
          )}

          {/* Nickname input */}
          <div className="input-group">
            <label className="input-label">Your Nickname</label>
            <input
              className="fancy-input"
              type="text"
              placeholder="e.g. CardShark99"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={16}
              autoFocus
            />
          </div>

          {/* Room ID input */}
          <div className="input-group">
            <label className="input-label">Room ID</label>
            <input
              className="fancy-input"
              type="text"
              placeholder="e.g. 1234"
              value={room}
              onChange={e => {
                setRoom(e.target.value)
                if (onClearError) onClearError() // clears server error when they retype
              }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {/* Join button */}
          <button className="room-join-btn" onClick={handleJoin}>
            Join / Create Room →
          </button>

          <p className="room-footer-hint">
            Share the room ID with a friend — they type the same number and you're in
          </p>
        </div>
      </div>
    </div>
  )
}

export default RoomPage

