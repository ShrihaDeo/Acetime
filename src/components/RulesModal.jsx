const sectionStyle = {
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 11,
  color: "var(--yellow)",
  letterSpacing: 1,
  textTransform: "uppercase",
  marginTop: 18,
  marginBottom: 10,
}

const listStyle = {
  color: "rgba(255,255,255,0.9)",
  fontSize: 14,
  lineHeight: 1.7,
  paddingLeft: 18,
  margin: 0,
}

const paraStyle = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 13,
  lineHeight: 1.6,
  marginTop: 0,
}

function RulesModal({ show, onClose }) {
  if (!show) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 220,
        background: "rgba(5,5,10,0.85)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "100%",
          background: "rgba(15,15,26,0.98)",
          border: "1px solid rgba(180,77,255,0.25)",
          borderRadius: 18,
          padding: "28px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 16,
            fontWeight: 400,
            color: "white",
            margin: 0,
            letterSpacing: 1,
          }}>
            How To Play
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: 22,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p style={paraStyle}>
          Two games are available. <strong>Last Card</strong> is the default; <strong>Blackjack</strong> is the second mode.
        </p>

        <h3 style={sectionStyle}>Last Card — basics</h3>
        <p style={paraStyle}>
          Match the top card by suit or rank. First to empty their hand wins. If you can't play, draw one card and your turn ends.
        </p>

        <h3 style={sectionStyle}>Special cards</h3>
        <ul style={listStyle}>
          <li><b>2</b> — next player draws 2 (stackable with other 2s/3s)</li>
          <li><b>3</b> — next player draws 3 (stackable)</li>
          <li><b>8</b> — reverses direction</li>
          <li><b>J</b> — skips the next player</li>
          <li><b>A</b> — wild; pick the suit when you play it</li>
        </ul>

        <h3 style={sectionStyle}>Last Card rule</h3>
        <ul style={listStyle}>
          <li>Call <b>"Last Card!"</b> when you're about to play down to one card.</li>
          <li>Forget? Your opponent can catch you before they take their own turn — you draw 2.</li>
          <li>You can't win with an Ace as your final card.</li>
        </ul>

        <h3 style={sectionStyle}>Penalties</h3>
        <ul style={listStyle}>
          <li>Playing out of turn or an illegal card — your card is rejected.</li>
          <li>If the draw pile runs out, the discard pile (minus the top card) is shuffled back in.</li>
        </ul>

        <h3 style={sectionStyle}>Blackjack</h3>
        <ul style={listStyle}>
          <li>Each player starts with <b>500 chips</b>. Both players play against the dealer (not each other).</li>
          <li><b>Bet</b> chips before each round (min 10). Both bets must be in before cards are dealt.</li>
          <li>Both players get 2 face-up cards. Dealer gets 1 face-up, 1 face-down (hole card).</li>
          <li>On your turn: <b>Hit</b> (take a card), <b>Stand</b> (keep score), or <b>Double</b> (double bet, take exactly 1 card, then stand).</li>
          <li>Card values: 2–10 face value · J/Q/K = 10 · Ace = 11 (or 1 if 11 busts).</li>
          <li>Once both players are done, dealer reveals hole card and must hit until 17+.</li>
          <li>Payouts: <b>Blackjack</b> (Ace + 10 on first 2 cards) pays 3:2 · <b>Win</b> pays 1:1 · <b>Push</b> returns the bet · <b>Bust or lose</b> loses the bet.</li>
        </ul>

        <button
          onClick={onClose}
          className="btn btn-block btn-red"
          style={{ marginTop: 18 }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

export default RulesModal
