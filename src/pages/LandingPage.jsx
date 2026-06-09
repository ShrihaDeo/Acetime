import CardLogo from '../assets/ace_logo.svg'
import { playGenericClick } from '../utils/sounds'

function LandingPage({ onStart }) {
  return (
    <div>
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-mark">A</span>
          ACETIME
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#support">Support</a>
          <a href="#about">About</a>
        </div>
      </nav>

      <section className="band cream">
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <span className="eyebrow fade-up">↓ press start ↓</span>
            <h1 className="h1 fade-up d1">
              Game night<br />
              with the squad.<br />
              <span style={{ color: 'var(--red)' }}>From anywhere.</span>
            </h1>
            <p className="body-md fade-up d2" style={{ marginTop: 24, maxWidth: 460 }}>
              Hop into a room, fire up the cam, deal a hand. Last Card. Blackjack. More on the way. No accounts, no installs — just a room code and a vibe.
            </p>
            <div className="fade-up d3" style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
              <button className="btn btn-xl btn-red" onClick={() => { playGenericClick(); onStart() }}>▶ START PLAYING</button>
              <button className="btn btn-xl" onClick={() => { playGenericClick(); onStart() }}>Got a room code?</button>
            </div>
            <div className="fade-up d4" style={{ marginTop: 28, display: 'flex', gap: 12 }}>
              <span className="badge">⚡ INSTANT</span>
              <span className="badge new">FREE</span>
              <span className="badge hot">2 GAMES</span>
            </div>
          </div>

          <HeroCardStack />
        </div>
      </section>

      <section id="how" className="band" style={{ background: '#fff', paddingTop: 64, paddingBottom: 64, scrollMarginTop: 64 }}>
        <div className="container">
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <ValueProp eyebrow="HD video" title="See every reaction" body="WebRTC video and audio between you and your friend — works straight in the browser." />
            <ValueProp eyebrow="Real-time" title="Synced card play" body="Every move mirrors across both screens instantly. No turn delays, no spectator view." />
            <ValueProp eyebrow="Zero friction" title="Share a room code" body="Type a name, share any number, start playing. No account, no install, no wait." />
          </div>
        </div>
      </section>

      <footer id="support" className="footer">
        <div className="footer-cols">
          <div>
            <div className="nav-logo" style={{ marginBottom: 14, color: 'var(--bg-main)' }}>
              <span className="nav-mark" style={{ background: 'var(--yellow)', color: 'var(--ink)' }}>A</span>
              ACETIME
            </div>
            <p className="body-sm" style={{ opacity: 0.85, maxWidth: 280 }}>
              Card games over video, for friends who don't live next door.
            </p>
          </div>
          <FooterCol title="SUPPORT" items={[
            { label: '📧 Email us',     href: 'mailto:ya357@waikato.students.ac.nz' },
            { label: '🐞 Report a bug', href: 'https://github.com/ShrihaDeo/Acetime/issues/new', external: true },
            { label: '📡 Status',       href: 'https://github.com/ShrihaDeo/Acetime',           external: true },
          ]} />
          <FooterCol id="about" title="ABOUT" items={[
            { label: '💻 GitHub',   href: 'https://github.com/ShrihaDeo/Acetime',                       external: true },
            { label: '👥 The team', href: 'https://github.com/ShrihaDeo/Acetime/graphs/contributors', external: true },
            { label: '👋 Contact',  href: 'mailto:ya357@waikato.students.ac.nz' },
          ]} />
        </div>
      </footer>
    </div>
  )
}

function ValueProp({ eyebrow, title, body }) {
  return (
    <div>
      <p className="eyebrow blue" style={{ marginBottom: 12 }}>{eyebrow}</p>
      <h3 className="h3" style={{ marginBottom: 12 }}>{title}</h3>
      <p className="body-md muted">{body}</p>
    </div>
  )
}

function FooterCol({ id, title, items }) {
  return (
    <div id={id}>
      <h4>{title}</h4>
      <ul>
        {items.map(item => (
          <li key={item.label}>
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HeroCardStack() {
  const cards = [
    { v: 'A',  s: '♠', red: false, r: -12 },
    { v: 'K',  s: '♥', red: true,  r: -3 },
    { v: '10', s: '♣', red: false, r: 6 },
    { v: 'J',  s: '♦', red: true,  r: 14 },
  ]
  return (
    <div className="fade-up d4" style={{
      aspectRatio: '1 / 1',
      background: 'var(--bg-yellow)',
      border: 'var(--border-w) solid var(--ink)',
      boxShadow: 'var(--shadow)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            width: 96, height: 132,
            background: '#fff',
            color: c.red ? 'var(--red)' : 'var(--ink)',
            border: 'var(--border-w) solid var(--ink)',
            boxShadow: 'var(--shadow-sm)',
            padding: 8,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 14,
            transform: `rotate(${c.r}deg)`,
            marginLeft: i === 0 ? 0 : -22,
          }}>
            <span style={{ fontSize: 18 }}>{c.v}{c.s}</span>
            <span style={{ fontSize: 18, textAlign: 'right', transform: 'rotate(180deg)' }}>{c.v}{c.s}</span>
          </div>
        ))}
      </div>
      <img src={CardLogo} alt="" style={{ position: 'absolute', bottom: 12, right: 12, width: 24, opacity: 0.5 }} />
    </div>
  )
}

export default LandingPage
