function EndGameModal({ show, kind, title, subtitle, onPlayAgain, onBack }) {
  if (!show) return null
  const icon = kind === 'win' ? '🏆' : kind === 'tie' ? '🤝' : '🎴'
  return (
    <div className="modal-backdrop">
      <div className={`modal-box ${kind === 'lose' ? 'lose' : ''}`}>
        <div className="modal-trophy">{icon}</div>
        <h2 className={`modal-title ${kind === 'lose' ? 'lose' : 'win'}`}>{title}</h2>
        <p className="modal-sub">{subtitle}</p>
        <div className="modal-actions">
          <button className="btn btn-xl btn-red" onClick={onPlayAgain}>▶ PLAY AGAIN</button>
          <button className="btn btn-xl" onClick={onBack}>Back to call</button>
        </div>
      </div>
    </div>
  )
}

export default EndGameModal
