function Card({ card, onClick, disabled }) {
  const isRed = card.suit === '♥' || card.suit === '♦'

  return (
    <div
      className={`card ${isRed ? 'card-red' : 'card-black'} ${disabled ? 'card-disabled' : ''}`}
      onClick={!disabled ? onClick : undefined}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      <span className="card-corner top-left">
        <span className="card-value">{card.value}</span>
        <span className="card-suit">{card.suit}</span>
      </span>
      <span className="card-center">{card.suit}</span>
      <span className="card-corner bottom-right">
        <span className="card-value">{card.value}</span>
        <span className="card-suit">{card.suit}</span>
      </span>
    </div>
  )
}

export default Card