import { useState } from 'react'

function RoomPage({ onJoin }) {
  const [room, setRoom] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  const handleJoin = () => {
    if (nickname.trim() === '') { setError('Please enter a nickname.'); return; }
    if (room.trim() === '')     { setError('Please enter a room ID.');  return; }
    if (!/^\d+$/.test(room))   { setError('Room ID must be numbers only.'); return; }
    setError('')
    onJoin(room, nickname.trim())
  }

  return (
    <div>
      <div className="suits-bg">
        <span className="suit red">♥</span>
        <span className="suit">♠</span>
        <span className="suit red">♦</span>
        <span className="suit">♣</span>
      </div>

      <div className="room-page">
        <div className="room-card">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '28px', marginBottom: '4px' }}>🃏</p>
            <h2 className="room-card-title">Join a Room</h2>
            <p className="room-card-subtitle">Enter your name and a room ID to start</p>
            <div className="gold-line" style={{ marginTop: '16px' }} />
          </div>

          {/* Error */}
          {error && <p className="error-msg">{error}</p>}

          {/* Nickname */}
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

          {/* Room ID */}
          <div className="input-group">
            <label className="input-label">Room ID</label>
            <input
              className="fancy-input"
              type="text"
              placeholder="e.g. 1234"
              value={room}
              onChange={e => setRoom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <button className="room-join-btn" onClick={handleJoin}>
            Join / Create Room →
          </button>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
            Share the room ID with a friend to play together
          </p>
        </div>
      </div>
    </div>
  )
}

export default RoomPage
