import { useEffect, useRef } from 'react'
import CardLogo from '../assets/ace_logo.svg'

// Generates floating particles on a canvas for the background
function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLORS = ['#b44dff', '#00d4ff', '#ff3dac', '#00ffb3', '#ffd700']
    const SUITS  = ['♠', '♥', '♦', '♣']

    const particles = Array.from({ length: 38 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight + window.innerHeight,
      size: Math.random() * 14 + 6,
      speed: Math.random() * 0.5 + 0.15,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      suit: Math.random() > 0.5 ? SUITS[Math.floor(Math.random() * SUITS.length)] : null,
      opacity: Math.random() * 0.4 + 0.1,
      drift: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.005,
    }))

    let animId
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.y -= p.speed
        p.wobble += p.wobbleSpeed
        p.x += Math.sin(p.wobble) * p.drift

        if (p.y < -40) {
          p.y = canvas.height + 40
          p.x = Math.random() * canvas.width
        }

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.shadowBlur = 12
        ctx.shadowColor = p.color
        ctx.font = `${p.size}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.suit ?? '·', p.x, p.y)
        ctx.restore()
      }

      animId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  )
}

function LandingPage({ onStart }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Animated background layers */}
      <div className="mesh-bg" />
      <div className="grid-overlay" />
      <div className="noise" />
      <ParticleCanvas />

      {/* Suit watermarks */}
      <div className="suits-bg">
        <span className="suit">♥</span>
        <span className="suit">♠</span>
        <span className="suit">♦</span>
        <span className="suit">♣</span>
      </div>

      <div className="landing-page">
        {/* Logo */}
        <img src={CardLogo} alt="AceTime" className="landing-logo" />

        {/* Eyebrow */}
        <p className="landing-eyebrow">Video · Cards · Friends</p>

        {/* Title */}
        <h1 className="landing-title">
          <span className="line1">Play Together</span>
          <span className="line2">Stay Connected</span>
        </h1>

        {/* Subtitle */}
        <p className="landing-sub">
          Video call your friends and play card games <strong>live</strong>.<br />
          No account. No download. Just a <strong>room code</strong>.
        </p>

        {/* CTA */}
        <div className="landing-cta-row">
          <button className="btn-neon" onClick={onStart}>
            Create or Join a Room →
          </button>
          <span className="landing-hint">Share a 4-digit code and you're in</span>
        </div>

        {/* Stats strip */}
        <div className="landing-stats">
          <div className="stat-item">
            <span className="stat-num blue">P2P</span>
            <span className="stat-label">Video call</span>
          </div>
          <div className="stat-item">
            <span className="stat-num purple">Live</span>
            <span className="stat-label">Card games</span>
          </div>
          <div className="stat-item">
            <span className="stat-num pink">Zero</span>
            <span className="stat-label">Account needed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage

