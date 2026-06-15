// palette is picked from the first letter of the name so the same person
// always gets the same colour
const palettes = [
  ["#b44dff", "#7c00ff"],
  ["#ff3dac", "#c0006e"],
  ["#00d4ff", "#0088cc"],
  ["#00ffb3", "#00aa77"],
  ["#ffd700", "#cc9900"],
  ["#ff6b35", "#cc3300"],
]

function Avatar({ name, size = 72 }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?"
  const [a, b] = palettes[name ? name.charCodeAt(0) % palettes.length : 0]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${a}, ${b})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: "800",
        color: "white",
        userSelect: "none",
        flexShrink: 0,
        fontFamily: "'Fredoka', sans-serif",
        boxShadow: `0 0 24px ${a}55, 0 0 60px ${a}22`,
      }}
    >
      {initial}
    </div>
  )
}

export default Avatar
