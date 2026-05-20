import CardLogo from '../assets/ace_logo.svg'

function LandingPage({ onStart }) {
  return (
    <div>
      <div className="suits-bg">
        <span className="suit red">♥</span>
        <span className="suit">♠</span>
        <span className="suit red">♦</span>
        <span className="suit">♣</span>
      </div>

      <div className="landing-page">
        <img src={CardLogo} alt="AceTime Logo" className="landing-logo" />

        <div className="gold-line" style={{ marginBottom: '24px' }} />

        <h1 className="landing-title">
          Ace<span className="accent">Time</span>
        </h1>

        <p className="landing-subtitle">
          Video call your friends. Play cards together.<br />
          No account. No download. Just share a room code.
        </p>

        <button className="landing-cta" onClick={onStart}>
          Create or Join a Room
        </button>

        <div className="landing-badges">
          <span className="badge">
            <span className="badge-dot" />
            Peer-to-peer video
          </span>
          <span className="badge">
            <span className="badge-dot" style={{ background: '#c0392b', boxShadow: '0 0 6px #c0392b' }} />
            Live card games
          </span>
          <span className="badge">
            <span className="badge-dot" style={{ background: '#7c3aed', boxShadow: '0 0 6px #7c3aed' }} />
            No account needed
          </span>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
