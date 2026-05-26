function GameSelectOverlay({ onSelect }) {
  return (
    <div className="overlay">
      <div className="overlay-box">
        <h2>Choose a Game</h2>
        <button onClick={() => onSelect('LastCard')}>Last Card</button>
      </div>
    </div>
  )
}

export default GameSelectOverlay