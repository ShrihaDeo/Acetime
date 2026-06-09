import { useState } from 'react'
import { Frog } from '../components/Pets'
import { playGenericClick } from '../utils/sounds'

function RoomPage({ onJoin, defaultRoom = '', serverError = '', onClearError }) {
  const [room, setRoom]         = useState(defaultRoom)
  const [nickname, setNickname] = useState('')
  const [error, setError]       = useState('')

  const handleJoin = () => {
    if (!nickname.trim())     { setError('Please enter a nickname.'); return }
    if (!room.trim())         { setError('Please enter a room ID.');  return }
    if (!/^\d+$/.test(room))  { setError('Room ID must be numbers only.'); return }
    setError('')
    onJoin(room, nickname.trim())
  }

  const displayError = error || serverError

  return (
    <div>
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-mark">A</span>
          ACETIME
        </div>
        <div className="nav-links" />
      </nav>

      <section className="band blue">
        <Frog style={{ bottom: 32, right: '5%', width: 84, height: 84 }} />

        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <span className="eyebrow blue fade-up">⌒ pull up a chair ⌒</span>
            <h2 className="h2 fade-up d1">
              Pick a handle<br />
              &amp; a room code.
            </h2>
            <p className="body-md muted fade-up d2" style={{ marginTop: 16, maxWidth: 380 }}>
              Type any number, share it with your crew, and you're all at the same table in seconds.
            </p>
          </div>

          <div className="panel fade-up d1">
            <h4 className="h4" style={{ marginBottom: 10 }}>Your handle</h4>
            <input
              className="input"
              type="text"
              placeholder="e.g. cardShark99"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={16}
              autoFocus
            />

            <h4 className="h4" style={{ marginTop: 22, marginBottom: 10 }}>Room code</h4>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="Any number, e.g. 42"
              value={room}
              onChange={e => {
                setRoom(e.target.value)
                if (onClearError) onClearError()
              }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />

            {displayError && (
              <p style={{ color: 'var(--red)', marginTop: 12, fontWeight: 600 }} role="alert">
                ⚠ {displayError}
              </p>
            )}

            <button
              className="btn btn-xl btn-red btn-block"
              onClick={() => { playGenericClick(); handleJoin() }}
              style={{ marginTop: 24 }}
            >
              ▶ JOIN ROOM
            </button>

            <p className="body-sm muted center-text" style={{ marginTop: 14 }}>
              We'll need your cam &amp; mic 📷🎤
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RoomPage
