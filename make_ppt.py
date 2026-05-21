from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import copy

# ── Palette ────────────────────────────────────────────────────────────────────
BG       = RGBColor(0x05, 0x05, 0x0a)   # near-black
ACCENT   = RGBColor(0x00, 0xff, 0xb3)   # neon green  (matches app)
ACCENT2  = RGBColor(0x00, 0xd4, 0xff)   # neon blue
WHITE    = RGBColor(0xff, 0xff, 0xff)
MUTED    = RGBColor(0x88, 0x88, 0xaa)
CODE_BG  = RGBColor(0x0d, 0x0d, 0x1a)
CODE_FG  = RGBColor(0xb4, 0x4d, 0xff)   # purple for keywords
STR_FG   = RGBColor(0x00, 0xff, 0xb3)   # green for strings/values

W = Inches(13.33)   # widescreen 16:9
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H

BLANK = prs.slide_layouts[6]   # completely blank


# ── Helpers ────────────────────────────────────────────────────────────────────

def bg(slide):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG

def box(slide, left, top, width, height, text="", bold=False, italic=False,
        size=20, color=WHITE, align=PP_ALIGN.LEFT, bg_color=None, wrap=True):
    txBox = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.bold   = bold
    run.font.italic = italic
    run.font.size   = Pt(size)
    run.font.color.rgb = color
    if bg_color:
        fill = txBox.fill
        fill.solid()
        fill.fore_color.rgb = bg_color
    return txBox

def title_box(slide, text, sub=None):
    box(slide, 0.5, 0.3, 12.3, 0.9, text,
        bold=True, size=38, color=ACCENT, align=PP_ALIGN.LEFT)
    if sub:
        box(slide, 0.5, 1.15, 12.3, 0.45, sub,
            size=18, color=MUTED, align=PP_ALIGN.LEFT)

def rule(slide, top, color=ACCENT):
    line = slide.shapes.add_connector(
        1,  # MSO_CONNECTOR.STRAIGHT
        Inches(0.5), Inches(top),
        Inches(12.83), Inches(top))
    line.line.color.rgb = color
    line.line.width = Pt(1)

def code_box(slide, left, top, width, height, lines):
    """Render a dark code block.  lines = list of (text, color) tuples."""
    cb = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height))
    cb.fill.solid()
    cb.fill.fore_color.rgb = CODE_BG
    tf = cb.text_frame
    tf.word_wrap = False
    first = True
    for (text, color) in lines:
        if first:
            p = tf.paragraphs[0]
            first = False
        else:
            p = tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(0)
        p.space_after  = Pt(0)
        run = p.add_run()
        run.text = text
        run.font.size = Pt(13)
        run.font.color.rgb = color
        run.font.name = "Courier New"
    return cb

def bullet(slide, left, top, width, items, size=18, gap=0.38):
    """items = list of (indent_level, text, color)"""
    for i, (lvl, text, color) in enumerate(items):
        prefix = "  " * lvl + ("• " if lvl == 0 else "– ")
        box(slide, left + lvl * 0.18, top + i * gap, width, 0.36,
            prefix + text, size=size, color=color)

def chip(slide, left, top, label, color=ACCENT):
    """Small coloured label chip."""
    box(slide, left, top, 1.8, 0.32, label,
        bold=True, size=13, color=BG, align=PP_ALIGN.CENTER,
        bg_color=color)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — Cover
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)

box(s, 0.5, 1.6, 12.3, 1.1,
    "AceTime — Backend Sync & WebRTC",
    bold=True, size=44, color=ACCENT, align=PP_ALIGN.CENTER)

box(s, 0.5, 2.75, 12.3, 0.5,
    "How I built real-time video + game state synchronisation",
    size=22, color=WHITE, align=PP_ALIGN.CENTER)

box(s, 0.5, 3.35, 12.3, 0.4,
    "Ang Yu Liang  ·  feature/backend-sync  ·  May 20–21 2026",
    size=16, color=MUTED, align=PP_ALIGN.CENTER)

# decorative suit row
box(s, 0.5, 5.9, 12.3, 0.7,
    "♠   ♥   ♦   ♣",
    size=36, color=RGBColor(0x22,0x22,0x33), align=PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — Fisher-Yates Shuffle
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "Fisher-Yates Shuffle", "Used in game.js · buildDeck() → shuffle()")
rule(s, 1.65)

box(s, 0.5, 1.85, 6.5, 0.4,
    "What it is", bold=True, size=20, color=ACCENT2)
box(s, 0.5, 2.25, 6.3, 1.1,
    "An algorithm that produces a uniformly random permutation of an array. "
    "Every possible ordering has exactly equal probability — no card is more "
    "likely to appear in any position than another.",
    size=16, color=WHITE)

box(s, 0.5, 3.45, 6.5, 0.4,
    "Why the naïve version is wrong", bold=True, size=20, color=RGBColor(0xff,0x6b,0x35))
code_box(s, 0.5, 3.9, 6.0, 1.15, [
    ("// ✗ Biased — picks j from full range each time", MUTED),
    ("for (let i = 0; i < deck.length; i++) {",        WHITE),
    ("  let j = Math.floor(Math.random() * deck.length);", RGBColor(0xff,0x6b,0x35)),
    ("  [deck[i], deck[j]] = [deck[j], deck[i]];",    WHITE),
    ("}",                                               WHITE),
])

box(s, 7.2, 1.85, 5.6, 0.4,
    "Correct Fisher-Yates", bold=True, size=20, color=ACCENT)
code_box(s, 7.2, 2.3, 5.6, 1.35, [
    ("// ✓ Unbiased — shrink range each step",         MUTED),
    ("for (let i = deck.length - 1; i > 0; i--) {",   WHITE),
    ("  const j = Math.floor(",                        WHITE),
    ("    Math.random() * (i + 1)",                    STR_FG),
    ("  );",                                           WHITE),
    ("  [deck[i], deck[j]] = [deck[j], deck[i]];",    WHITE),
    ("}",                                              WHITE),
])

box(s, 7.2, 3.75, 5.6, 0.4,
    "Why it works", bold=True, size=20, color=ACCENT2)
bullet(s, 7.2, 4.18, 5.5, [
    (0, "Iteration i picks 1 card from the remaining i+1", WHITE),
    (0, "Probability of any card reaching any slot = 1/n", WHITE),
    (0, "O(n) time — single pass through the deck",        WHITE),
    (0, "Standard in card games, lotteries, simulations",  MUTED),
], size=15, gap=0.37)

box(s, 0.5, 5.2, 6.3, 0.35,
    "Key insight: picking j from [i, end] (not [0, end]) is what removes the bias.",
    size=14, color=MUTED, italic=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — React Refs vs State (camera bug)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "React: useRef vs useState", "Why the camera didn't show — and how I fixed it")
rule(s, 1.65)

box(s, 0.5, 1.8, 4.0, 0.38,
    "useRef  — imperative DOM handle", bold=True, size=18, color=ACCENT2)
bullet(s, 0.5, 2.22, 4.1, [
    (0, "Holds a mutable value (.current)",           WHITE),
    (0, "Changing it does NOT trigger a re-render",   RGBColor(0xff,0x6b,0x35)),
    (0, "Used to attach to a DOM element (ref={})",   WHITE),
], size=15, gap=0.35)

box(s, 4.9, 1.8, 4.0, 0.38,
    "useState  — reactive value", bold=True, size=18, color=ACCENT)
bullet(s, 4.9, 2.22, 4.1, [
    (0, "Holds a value React tracks",                WHITE),
    (0, "Changing it triggers a re-render",          STR_FG),
    (0, "After re-render, useEffect runs again",     WHITE),
], size=15, gap=0.35)

box(s, 0.5, 3.3, 12.3, 0.38,
    "The Bug", bold=True, size=20, color=RGBColor(0xff,0x3b,0x30))
code_box(s, 0.5, 3.72, 5.8, 0.75, [
    ("// ✗ Sets srcObject once inside async callback",   MUTED),
    ("localVideoRef.current.srcObject = stream",         RGBColor(0xff,0x6b,0x35)),
    ("// If React re-renders the <video> element, srcObject is lost", MUTED),
])

box(s, 6.6, 3.3, 6.2, 0.38,
    "The Fix", bold=True, size=20, color=STR_FG)
code_box(s, 6.6, 3.72, 6.2, 1.55, [
    ("const [localStream, setLocalStream] = useState(null)", WHITE),
    ("",                                                      WHITE),
    ("// In getUserMedia.then():",                            MUTED),
    ("setLocalStream(stream)   // tells React stream is ready",STR_FG),
    ("",                                                      WHITE),
    ("// Separate effect — runs after EVERY render:",         MUTED),
    ("useEffect(() => {",                                     WHITE),
    ("  localVideoRef.current.srcObject = localStream",       STR_FG),
    ("}, [localStream])",                                     WHITE),
])

box(s, 0.5, 5.55, 12.3, 0.5,
    "Result: srcObject is re-applied after any re-render, so the camera works "
    "the instant getUserMedia resolves — no second player needed.",
    size=15, color=MUTED, italic=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — WebRTC + PeerJS
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "WebRTC & PeerJS — P2P Video", "How two browsers stream video directly to each other")
rule(s, 1.65)

box(s, 0.5, 1.82, 12.3, 0.38,
    "WebRTC is a browser API for peer-to-peer audio/video. PeerJS wraps its complex "
    "handshake into simple .call() / .answer() methods.",
    size=16, color=WHITE)

# Three-column flow
for i, (label, desc, col) in enumerate([
    ("1. Get Camera",
     "navigator.mediaDevices\n.getUserMedia(\n  {video:true, audio:true}\n)",
     ACCENT),
    ("2. Exchange Peer IDs\n(via Socket.io)",
     "peer.on('open', id =>\n  socket.emit('peer-id',\n  {room, peerId: id}))",
     ACCENT2),
    ("3. Call & Answer",
     "peer.call(otherId, stream)\n\npeer.on('call', call =>\n  call.answer(stream))",
     RGBColor(0xb4,0x4d,0xff)),
]):
    left = 0.5 + i * 4.2
    box(s, left, 2.42, 3.9, 0.38, label, bold=True, size=17, color=col)
    code_box(s, left, 2.84, 3.9, 1.35, [(line, WHITE) for line in desc.split("\n")])

box(s, 0.5, 4.38, 12.3, 0.38,
    "Why Socket.io is still needed — WebRTC requires a 'signalling channel' "
    "to exchange peer IDs before the P2P connection can open. Socket.io plays "
    "that role; after connection, video never touches the server.",
    size=15, color=MUTED, italic=True)

rule(s, 5.0, MUTED)

box(s, 0.5, 5.1, 12.3, 0.38,
    "The Asymmetric Video Bug I Fixed", bold=True, size=19, color=RGBColor(0xff,0x6b,0x35))
bullet(s, 0.5, 5.52, 12.0, [
    (0, "Player 1 joined first → emitted peer-id → nobody was listening yet → peer-id lost", RGBColor(0xff,0x6b,0x35)),
    (0, 'Fix: server emits "request-peer-id" to the whole room when Player 2 joins → Player 1 re-sends their ID', STR_FG),
    (0, "Player 2 now receives the ID, calls Player 1, and both get video",                  WHITE),
], size=15, gap=0.37)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — Socket.io Room Management
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "Socket.io — Room-Based State", "server/index.js · how the server keeps everyone in sync")
rule(s, 1.65)

box(s, 0.5, 1.82, 5.8, 0.38,
    "What a Socket.io Room is", bold=True, size=18, color=ACCENT2)
bullet(s, 0.5, 2.22, 5.6, [
    (0, "A named channel on the server",                         WHITE),
    (0, "socket.join(room)  adds a client to it",               WHITE),
    (0, "io.to(room).emit(...)  broadcasts to all members",     WHITE),
    (0, "socket.to(room).emit(...)  broadcasts except sender",  WHITE),
], size=15, gap=0.36)

box(s, 6.8, 1.82, 5.8, 0.38,
    "Server state objects", bold=True, size=18, color=ACCENT)
code_box(s, 6.8, 2.22, 6.0, 1.35, [
    ("const roomStates    = {}",  WHITE),
    ("// { roomId: gameState }",  MUTED),
    ("",                          WHITE),
    ("const roomNicknames = {}",  WHITE),
    ("// { roomId: { socketId: 'name' } }", MUTED),
    ("",                          WHITE),
    ("// Deleted when both players leave", MUTED),
])

rule(s, 3.82, MUTED)

box(s, 0.5, 3.95, 12.3, 0.38,
    "Reconnection Remapping — the hard part", bold=True, size=19, color=RGBColor(0xb4,0x4d,0xff))
box(s, 0.5, 4.35, 6.0, 0.35,
    "Problem: a disconnect gives the rejoining player a brand-new socket ID → "
    "their hand is stored under the old ID → game breaks.",
    size=14, color=WHITE)
code_box(s, 0.5, 4.78, 6.0, 1.5, [
    ("const ghostId = oldPlayerIds.find(",     WHITE),
    ("  id => !playerIds.includes(id)",        RGBColor(0xff,0x6b,0x35)),
    (");",                                     WHITE),
    ("const newId = playerIds.find(",          WHITE),
    ("  id => !oldPlayerIds.includes(id)",     STR_FG),
    (");",                                     WHITE),
    ("newHands[newId] = newHands[ghostId];",   WHITE),
    ("delete newHands[ghostId];",              MUTED),
])
box(s, 6.7, 4.35, 6.0, 0.35,
    "Walk-through:", bold=True, size=15, color=WHITE)
bullet(s, 6.7, 4.75, 5.8, [
    (0, "oldPlayerIds = [A, B]  (B disconnected)",  WHITE),
    (0, "playerIds now = [A, C]  (C = B's new ID)", WHITE),
    (0, "ghostId = B  (in old, not in new)",         RGBColor(0xff,0x6b,0x35)),
    (0, "newId   = C  (in new, not in old)",         STR_FG),
    (0, "Move B's hand → C; game continues",         ACCENT),
], size=14, gap=0.36)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — React useEffect & Cleanup
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "React useEffect & Dependency Array", "How I controlled when code runs and when it cleans up")
rule(s, 1.65)

box(s, 0.5, 1.82, 5.8, 0.38,
    "Three useEffects in CallScreen", bold=True, size=18, color=ACCENT)
bullet(s, 0.5, 2.22, 5.6, [
    (0, "Stream sync  — deps: [localStream, isCameraOff]", ACCENT),
    (0, "Socket listeners  — deps: [socket, opponentNickname]", ACCENT2),
    (0, "WebRTC / PeerJS  — deps: [socket, room]", RGBColor(0xb4,0x4d,0xff)),
], size=16, gap=0.4)

box(s, 0.5, 3.42, 5.8, 0.38,
    "Dependency array rules", bold=True, size=18, color=ACCENT2)
bullet(s, 0.5, 3.82, 5.6, [
    (0, "[]  → runs once on mount, cleanup on unmount", WHITE),
    (0, "[x] → re-runs whenever x changes",             WHITE),
    (0, "no array → runs after every render (avoid!)",  RGBColor(0xff,0x6b,0x35)),
], size=15, gap=0.37)

code_box(s, 6.8, 1.82, 6.0, 2.7, [
    ("useEffect(() => {",                                   WHITE),
    ("  // register listeners",                             MUTED),
    ("  socket.on('game-init', handler)",                   STR_FG),
    ("  socket.on('receive-move', handler)",                STR_FG),
    ("",                                                    WHITE),
    ("  return () => {   // CLEANUP",                       RGBColor(0xff,0x6b,0x35)),
    ("    socket.off('game-init')",                         RGBColor(0xff,0x6b,0x35)),
    ("    socket.off('receive-move')",                      RGBColor(0xff,0x6b,0x35)),
    ("  }",                                                 WHITE),
    ("}, [socket, opponentNickname])",                      ACCENT2),
    ("//  ↑ re-runs when opponent name is known",           MUTED),
])

rule(s, 4.82, MUTED)

box(s, 0.5, 4.96, 12.3, 0.35,
    "Why cleanup matters with Socket.io", bold=True, size=17, color=RGBColor(0xff,0x3b,0x30))
bullet(s, 0.5, 5.36, 12.0, [
    (0, "Without .off(), re-registering adds a duplicate listener → every event fires twice",  RGBColor(0xff,0x6b,0x35)),
    (0, "The return function in useEffect is called before the effect re-runs and on unmount", WHITE),
], size=15, gap=0.37)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — Deployment & Environment Switching
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "Deployment — Render + Environment Switching",
          "How the same codebase runs locally and in production")
rule(s, 1.65)

box(s, 0.5, 1.82, 5.8, 0.38,
    "The problem", bold=True, size=18, color=RGBColor(0xff,0x6b,0x35))
bullet(s, 0.5, 2.22, 5.6, [
    (0, "Local dev:  server is at localhost:3000",          WHITE),
    (0, "Production: server is at acetime-backend.onrender.com", WHITE),
    (0, "Hard-coding either URL breaks the other environment", RGBColor(0xff,0x6b,0x35)),
], size=15, gap=0.37)

box(s, 0.5, 3.42, 5.8, 0.38,
    "The fix — runtime URL detection", bold=True, size=18, color=ACCENT)
code_box(s, 0.5, 3.84, 6.0, 1.1, [
    ("const socket = io(",                                         WHITE),
    ("  window.location.hostname === 'localhost'",                 ACCENT2),
    ("    ? 'http://localhost:3000'",                              STR_FG),
    ("    : 'https://acetime-backend.onrender.com'",               STR_FG),
    (")",                                                          WHITE),
])

box(s, 7.0, 1.82, 5.8, 0.38,
    "Render server config", bold=True, size=18, color=ACCENT2)
code_box(s, 7.0, 2.22, 5.8, 1.55, [
    ("// Bind to all interfaces, not just localhost",   MUTED),
    ("httpServer.listen(",                              WHITE),
    ("  process.env.PORT || 3000,",                    STR_FG),
    ("  '0.0.0.0',   // ← required on Render",         ACCENT),
    ("  () => console.log('Server ready')",             MUTED),
    (")",                                               WHITE),
])

box(s, 7.0, 3.92, 5.8, 0.38,
    "Why 0.0.0.0?", bold=True, size=16, color=MUTED)
bullet(s, 7.0, 4.32, 5.6, [
    (0, "127.0.0.1 only accepts connections from the same machine", WHITE),
    (0, "0.0.0.0 accepts connections from any interface", STR_FG),
    (0, "Render routes external traffic to a container — 0.0.0.0 is required", WHITE),
], size=14, gap=0.36)

rule(s, 5.55, MUTED)
box(s, 0.5, 5.68, 12.3, 0.38,
    "process.env.PORT is set by Render automatically. "
    "The server reads it so Render controls which port is exposed — "
    "hardcoding 3000 would conflict with Render's port assignment.",
    size=14, color=MUTED, italic=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — Summary / What I can talk about
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK); bg(s)
title_box(s, "What I Built — At a Glance", "Things I can speak to confidently in the presentation")
rule(s, 1.65)

rows = [
    ("Fisher-Yates Shuffle",         "Unbiased deck randomisation — why picking j from [i,n] matters",           ACCENT),
    ("React useRef vs useState",      "Imperative DOM ops vs reactive state; why srcObject needs state to persist", ACCENT2),
    ("React useEffect cleanup",       "Duplicate socket listeners bug; return fn removes listeners before re-run",  RGBColor(0xb4,0x4d,0xff)),
    ("WebRTC / PeerJS handshake",     "getUserMedia → exchange peer IDs via Socket.io → peer.call / answer",       STR_FG),
    ("Asymmetric video bug fix",      "server re-emits request-peer-id so late joiners hear the first player's ID", ACCENT),
    ("Socket.io rooms",               "Room isolation, broadcast vs targeted emit, roomStates as source of truth",  ACCENT2),
    ("Reconnection remapping",        "ghostId/newId algorithm re-keys hands and player array without resetting",   RGBColor(0xb4,0x4d,0xff)),
    ("Render deployment",             "0.0.0.0 binding, process.env.PORT, runtime localhost vs production URL",     STR_FG),
]

for i, (topic, desc, color) in enumerate(rows):
    top = 1.88 + i * 0.63
    box(s, 0.5, top, 3.5, 0.32, topic, bold=True, size=15, color=color)
    box(s, 4.0, top, 8.8, 0.32, desc,  size=14, color=WHITE)


prs.save("/Users/edward/Acetime/AceTime_Presentation.pptx")
print("Saved: AceTime_Presentation.pptx")
