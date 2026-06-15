// felt color themes — cycled via the Theme button on the game table
export const backgrounds = [
  { bg: "var(--bg-green)",  suits: ["♠", "♣"], accent: "var(--green)" },
  { bg: "var(--bg-orange)", suits: ["♦", "♥"], accent: "var(--orange)" },
  { bg: "var(--bg-blue)",   suits: ["♣", "♠"], accent: "var(--blue)" },
  { bg: "var(--bg-yellow)", suits: ["♥", "♦"], accent: "var(--red-d)" },
  { bg: "var(--bg-pink)",   suits: ["♠", "♦"], accent: "var(--red)" },
]

// games shown in the menu. `color` / `border` are vestigial from the neon era
// — the arcade tiles pick their own art background by id.
export const GAMES = [
  {
    id: 'lastcard',
    name: 'Last Card',
    description: 'Match suit or value. First to empty hand wins.',
    emoji: '🃏',
    color: 'rgba(180,77,255,0.3)',
    border: 'rgba(180,77,255,0.5)',
    available: true,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: "Get closer to 21 than your opponent — but don't go over.",
    emoji: '♠',
    color: 'rgba(0,212,255,0.25)',
    border: 'rgba(0,212,255,0.5)',
    available: true,
  },
  {
    id: 'comingsoon',
    name: 'Coming Soon',
    description: 'More games are on the way.',
    emoji: '✨',
    color: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    available: false,
  },
]
