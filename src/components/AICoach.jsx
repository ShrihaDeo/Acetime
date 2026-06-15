// presentational only — chat state and the askAI function live in CallScreen,
// which passes them in as props. that lets askAI keep direct access to gameState,
// gameMode, socket.id, nicknames without prop-drilling all of those down here.

function AICoach({
  open,
  onClose,
  gameMode,
  messages,
  loading,
  input,
  onInputChange,
  onSend,
  endRef,
}) {
  if (!open) return null

  const title =
    gameMode === 'blackjack' ? 'BLACKJACK COACH' :
    gameMode === 'lastcard'  ? 'LAST CARD COACH' : 'TABLE COACH'

  return (
    <div className="coach" style={{ width: 300 }}>
      <div className="coach-head">
        <span>🤖 {title}</span>
        <span className="coach-close" onClick={onClose}>×</span>
      </div>
      <div className="coach-body">
        <div className="coach-history">
          {messages.map((msg, i) => (
            <div key={i} className={`coach-msg ${msg.role === 'user' ? 'from-user' : ''}`}>
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="coach-msg">
              <span style={{ letterSpacing: 4 }}>...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="coach-form">
          <input
            className="input"
            placeholder="Ask about the rules…"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            disabled={loading}
          />
          <button className="btn btn-blue" onClick={onSend} disabled={loading}>
            {loading ? '…' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AICoach
