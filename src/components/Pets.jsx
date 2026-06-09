// hand-drawn pixel critters. each one is a 16x16 grid of <rect>s.
// pass style to position them on the page.

export function Cat({ style }) {
  return (
    <svg className="pet" style={style} viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="3"  y="2"  width="2" height="2" fill="#e88c4a" />
      <rect x="4"  y="3"  width="1" height="1" fill="#f4b27a" />
      <rect x="11" y="2"  width="2" height="2" fill="#e88c4a" />
      <rect x="11" y="3"  width="1" height="1" fill="#f4b27a" />
      <rect x="3"  y="4"  width="10" height="5" fill="#f0a060" />
      <rect x="5"  y="4"  width="1" height="1" fill="#e88c4a" />
      <rect x="10" y="4"  width="1" height="1" fill="#e88c4a" />
      <rect x="5"  y="6"  width="1" height="2" fill="#1e2538" />
      <rect x="10" y="6"  width="1" height="2" fill="#1e2538" />
      <rect x="5"  y="6"  width="1" height="1" fill="#fff" />
      <rect x="10" y="6"  width="1" height="1" fill="#fff" />
      <rect x="8"  y="7"  width="1" height="1" fill="#e63946" />
      <rect x="4"  y="9"  width="8" height="5" fill="#f0a060" />
      <rect x="6"  y="10" width="4" height="3" fill="#ffd6a3" />
      <rect x="4"  y="14" width="2" height="1" fill="#e88c4a" />
      <rect x="10" y="14" width="2" height="1" fill="#e88c4a" />
      <rect x="12" y="11" width="1" height="3" fill="#e88c4a" />
      <rect x="13" y="9"  width="1" height="3" fill="#e88c4a" />
    </svg>
  )
}

export function Frog({ style }) {
  return (
    <svg className="pet" style={style} viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="3"  y="3" width="3" height="3" fill="#fff" />
      <rect x="10" y="3" width="3" height="3" fill="#fff" />
      <rect x="4"  y="4" width="1" height="2" fill="#1e2538" />
      <rect x="11" y="4" width="1" height="2" fill="#1e2538" />
      <rect x="2"  y="6" width="12" height="7" fill="#6bbf5a" />
      <rect x="2"  y="6" width="12" height="1" fill="#5aa84d" />
      <rect x="5"  y="9" width="6" height="4" fill="#a8d896" />
      <rect x="6"  y="8" width="4" height="1" fill="#1e2538" />
      <rect x="5"  y="8" width="1" height="1" fill="#1e2538" />
      <rect x="10" y="8" width="1" height="1" fill="#1e2538" />
      <rect x="1"  y="13" width="3" height="2" fill="#5aa84d" />
      <rect x="12" y="13" width="3" height="2" fill="#5aa84d" />
    </svg>
  )
}

export function Fox({ style }) {
  return (
    <svg className="pet" style={style} viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="2"  y="3"  width="2" height="3" fill="#d4581c" />
      <rect x="12" y="3"  width="2" height="3" fill="#d4581c" />
      <rect x="3"  y="5"  width="1" height="1" fill="#fff" />
      <rect x="12" y="5"  width="1" height="1" fill="#fff" />
      <rect x="3"  y="5"  width="10" height="4" fill="#e88c4a" />
      <rect x="5"  y="7"  width="6" height="2" fill="#fff" />
      <rect x="5"  y="6"  width="1" height="1" fill="#1e2538" />
      <rect x="10" y="6"  width="1" height="1" fill="#1e2538" />
      <rect x="7"  y="8"  width="2" height="1" fill="#1e2538" />
      <rect x="3"  y="9"  width="10" height="4" fill="#e88c4a" />
      <rect x="5"  y="11" width="6" height="2" fill="#fff" />
      <rect x="13" y="10" width="2" height="3" fill="#e88c4a" />
      <rect x="14" y="9"  width="1" height="1" fill="#fff" />
      <rect x="3"  y="13" width="2" height="1" fill="#d4581c" />
      <rect x="11" y="13" width="2" height="1" fill="#d4581c" />
    </svg>
  )
}
