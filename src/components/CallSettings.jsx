// camera / audio quality panel, opened from the ⚙ control in the call row or
// from the Last Card / Blackjack settings dropdown. apply buttons call back
// into CallScreen, which actually does the getUserMedia + replaceTrack work.

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-md ${active ? 'btn-yellow' : ''}`}
      style={{ flex: 1 }}
    >
      {children}
    </button>
  )
}

function CallSettings({
  open,
  onClose,
  resolution, setResolution,
  fps, setFps,
  noiseSuppression, setNoiseSuppression,
  echoCancellation, setEchoCancellation,
  onApplyCamera,
  onApplyAudio,
}) {
  if (!open) return null

  return (
    <div
      className="panel"
      style={{
        position: 'fixed',
        left: 18,
        bottom: 90,
        width: 320,
        padding: 20,
        zIndex: 150,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="pixel" style={{ fontSize: 11, letterSpacing: 1 }}>
          ⚙ CALL QUALITY
        </span>
        <span className="coach-close" onClick={onClose}>×</span>
      </div>

      <p className="pixel" style={{ fontSize: 9, color: 'var(--red)', marginBottom: 8 }}>
        CAMERA
      </p>
      <p className="body-sm" style={{ marginBottom: 6 }}>Resolution</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Toggle active={resolution === '720p'}  onClick={() => setResolution('720p')}>720p</Toggle>
        <Toggle active={resolution === '1080p'} onClick={() => setResolution('1080p')}>1080p</Toggle>
      </div>
      <p className="body-sm" style={{ marginBottom: 6 }}>Frame rate</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <Toggle active={fps === '30'} onClick={() => setFps('30')}>30 fps</Toggle>
        <Toggle active={fps === '60'} onClick={() => setFps('60')}>60 fps</Toggle>
      </div>
      <button className="btn btn-md btn-red btn-block" onClick={onApplyCamera} style={{ marginBottom: 18 }}>
        Apply camera
      </button>

      <p className="pixel" style={{ fontSize: 9, color: 'var(--red)', marginBottom: 8 }}>
        MIC
      </p>
      <label className="body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={noiseSuppression}
          onChange={e => setNoiseSuppression(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        Noise suppression
      </label>
      <label className="body-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={echoCancellation}
          onChange={e => setEchoCancellation(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        Echo cancellation
      </label>
      <button className="btn btn-md btn-red btn-block" onClick={onApplyAudio}>
        Apply mic
      </button>
    </div>
  )
}

export default CallSettings
