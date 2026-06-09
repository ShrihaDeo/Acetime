import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";
import EndCall from "../assets/end_call.svg";
import VideoOff from "../assets/video_off.svg";
import Mute from "../assets/mute.svg";
import Card from "../components/Card";

import cardPlaySound from '../assets/817551__silverdubloons__pickupcard05.wav'
import winSound from '../assets/274183__littlerobotsoundfactory__jingle_win_synth_04.wav'
import loseSound from '../assets/364929__jofae__game-die.mp3'
import { playGameClick } from '../utils/sounds'

const backgrounds = [
  {
    bg: "radial-gradient(circle at 30% 40%, #0d3d20 0%, #050f08 100%)",
    suits: ["♠", "♣"],
    accent: "#00ffb3",
  },
  {
    bg: "radial-gradient(circle at 70% 30%, #3d0d2a 0%, #0f0508 100%)",
    suits: ["♥", "♦"],
    accent: "#ff3dac",
  },
  {
    bg: "radial-gradient(circle at 40% 60%, #0d1a40 0%, #05080f 100%)",
    suits: ["♣", "♠"],
    accent: "#00d4ff",
  },
  {
    bg: "radial-gradient(circle at 60% 40%, #2a0d3d 0%, #08050f 100%)",
    suits: ["♦", "♥"],
    accent: "#b44dff",
  },
  {
    bg: "radial-gradient(circle at 50% 50%, #3d2a00 0%, #0f0a00 100%)",
    suits: ["♠", "♦"],
    accent: "#ffd700",
  },
];

// games for the menu screen
const GAMES = [
  {
    id: "lastcard",
    name: "Last Card",
    description: "Match suit or value. First to empty hand wins.",
    emoji: "🃏",
    color: "rgba(180,77,255,0.3)",
    border: "rgba(180,77,255,0.5)",
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
];

function Avatar({ name, size = 72 }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const palettes = [
    ["#b44dff", "#7c00ff"],
    ["#ff3dac", "#c0006e"],
    ["#00d4ff", "#0088cc"],
    ["#00ffb3", "#00aa77"],
    ["#ffd700", "#cc9900"],
    ["#ff6b35", "#cc3300"],
  ];
  const [a, b] = palettes[name ? name.charCodeAt(0) % palettes.length : 0];
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
        fontFamily: "'Syne', sans-serif",
        boxShadow: `0 0 24px ${a}55, 0 0 60px ${a}22`,
      }}
    >
      {initial}
    </div>
  );
}

function CallScreen({ socket, room, nickname, onLeave }) {
  // Tracks whether the chat panel is visible or hidden. Start as false.
  const [chatOpen, setChatOpen] = useState(false);
  // Tracks what the user is currently typing in the input box
  const [chatInput, setChatInput] = useState("");
  // An array of all messages in the conversation.
  // Starts with one one welcome message from the assistant.
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your AceTime assistant. Ask me about Last Card, Blackjack, or how to use the app — I'll adapt to whichever game you're in.",
    },
  ]);
  // true while waiting for Gemini to respond
  // used to show the loading dots and disable the button
  const [chatLoading, setChatLoading] = useState(false);
  // ref attached to an invisible div at the bottom of the chat
  // used to auto scroll down when new messages arrive
  const chatEndRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);

  const [syncStatus, setSyncStatus] = useState("Waiting for opponent...");
  const [pendingWild, setPendingWild] = useState(null);
  const [lastCardCalled, setLastCardCalled] = useState(false);
  const [callableOpponent, setCallableOpponent] = useState(null); // opponent socket id you can catch
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [isOpponentJoined, setIsOpponentJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isOpponentCameraOff, setIsOpponentCameraOff] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [nicknames, setNicknames] = useState({});
  const [copied, setCopied] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [gameMode, setGameMode] = useState("call"); // 'call' | 'menu' | 'lastcard'
  const [isHost, setIsHost] = useState(false);

  const playSound = (sound) => {
    new Audio(sound).play().catch(() => {});
  };

  const myStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pendingPeerIdRef = useRef(null);
  const prevHandRef = useRef([]);

  const myNickname = nicknames[socket.id] || nickname || "You";
  const opponentNickname =
    Object.entries(nicknames).find(([id]) => id !== socket.id)?.[1] ||
    "Opponent";
  const { accent } = backgrounds[bgIndex];

  // keep the local <video> attached to the stream. gameMode is in here because
  // when we switch screens react remounts the video tag and srcObject is gone
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff, gameMode]);

  // same idea for the opponent's stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [gameMode]);

  // ── Socket listeners ──
  useEffect(() => {
    socket.on('game-init', (state) => {
      setGameState(state)
      setIsOpponentJoined(true)
      setSyncStatus('Game on!')
    })
    socket.on('game-state-update', (state) => {
      setGameState(state)
      setSyncStatus(state.log)
      if (state.winner) {
        if (state.winner === 'tie') {
          setSyncStatus("It's a tie!")
        } else {
          setSyncStatus(`${nicknames[state.winner] || 'Someone'} wins!`)
          if (state.winner === socket.id) playSound(winSound)
          else playSound(loseSound)
        }
      }
      // reset Last Card call if hand grew back above 1 (e.g. drew cards)
      if (state.hands[socket.id]?.length > 1) setLastCardCalled(false)
    })
    socket.on('receive-move', (data) => {
      setSyncStatus(`${opponentNickname} played ${data.cardValue}${data.cardSuit}`)
    })
    socket.on('nicknames-update', setNicknames)
    socket.on('opponent-disconnected', () => {
      setIsOpponentJoined(false)
      setSyncStatus('Opponent disconnected...')
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    })
    socket.on('camera-status', ({ isCameraOff: off }) => setIsOpponentCameraOff(off))
    socket.on('player-joined', ({ isHost: host }) => setIsHost(host))
    socket.on('game-selected', ({ game }) => {
      setGameMode(game)
      setGameState(null)
    })
    socket.on('last-card-called', ({ playerID }) => {
      if (playerID === socket.id) setLastCardCalled(true)
      const name = playerID === socket.id ? 'You' : (nicknames[playerID] || 'Opponent')
      setSyncStatus(`${name} called Last Card!`)
    })
    socket.on('last-card-missed', ({ playerID }) => {
      if (playerID !== socket.id) setCallableOpponent(playerID)
    })
    socket.on('callable-cleared', () => setCallableOpponent(null))
    socket.on('called-out', ({ caller, victim }) => {
      setCallableOpponent(null)
      if (victim === socket.id) {
        setSyncStatus('Caught! You forgot Last Card — drew 2.')
        setLastCardCalled(false)
      } else if (caller === socket.id) {
        setSyncStatus('Nice catch! Opponent draws 2.')
      }
    })
    socket.on("game-error", (msg) => {
      setSyncStatus(typeof msg === "string" ? msg : "Move rejected");
    });

    return () => {
      socket.off("game-init");
      socket.off("game-state-update");
      socket.off("receive-move");
      socket.off("nicknames-update");
      socket.off("opponent-disconnected");
      socket.off("camera-status");
      socket.off("player-joined");
      socket.off("game-selected");
      socket.off("last-card-called");
      socket.off("last-card-missed");
      socket.off("callable-cleared");
      socket.off("called-out");
      socket.off("game-error");
    };
  }, [socket, opponentNickname, nicknames]);

  // -- WebRTC --
  useEffect(() => {
    const peer = new Peer(undefined, {
      config: {
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:standard.relay.metered.ca:80",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turn:standard.relay.metered.ca:80?transport=tcp",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turn:standard.relay.metered.ca:443",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
          {
            urls: "turns:standard.relay.metered.ca:443?transport=tcp",
            username: import.meta.env.VITE_TURN_USERNAME,
            credential: import.meta.env.VITE_TURN_CREDENTIAL,
          },
        ],
      },
    });

    // Call a peer by their ID, sending them our video stream.
    // This is triggered when we learn the other peer's ID from the server.
    const callPeer = (otherId) => {
      if (!myStreamRef.current) {
        pendingPeerIdRef.current = otherId;
        return;
      }
      console.log("Calling peer:", otherId);
      const call = peer.call(otherId, myStreamRef.current);
      if (!call) return;
      call.on("stream", (s) => {
        remoteStreamRef.current = s;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s;
        setIsOpponentJoined(true);
        setSyncStatus("Connected!");
      });
    };

    peer.on("open", (id) => socket.emit("peer-id", { room, peerId: id }));
    socket.on("request-peer-id", () => {
      if (peer.id) socket.emit("peer-id", { room, peerId: peer.id });
    });
    socket.on("peer-id", callPeer);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        setLocalStream(stream); // triggers the sync useEffect above → camera shows immediately
        if (pendingPeerIdRef.current) {
          callPeer(pendingPeerIdRef.current);
          pendingPeerIdRef.current = null;
        }
        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (s) => {
            remoteStreamRef.current = s;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s;
            setIsOpponentJoined(true);
          });
        });
      })
      .catch((err) => {
        console.error("Camera error:", err);
        // Show user-friendly message based on error type
        if (err.name === "NotAllowedError") {
          setCameraError(
            "Camera access was denied. Please allow camera access in your browser settings and refresh.",
          );
        } else if (err.name === "NotFoundError") {
          setCameraError(
            "No camera found. Please connect a camera and refresh.",
          );
        } else {
          setCameraError(
            "Could not access camera. Please check your device and try again.",
          );
        }
      });

    return () => {
      socket.off("peer-id");
      socket.off("request-peer-id");
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peer.destroy();
    };
  }, [socket, room]);

  // ── Helpers ──
  const toggleMute = () => {
    if (!myStreamRef.current) return;
    myStreamRef.current
      .getAudioTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((p) => !p);
  };

  const toggleCamera = () => {
    if (!myStreamRef.current) return;
    const next = !isCameraOff;
    myStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !next));
    setIsCameraOff(next);
    socket.emit("camera-status", { room, isCameraOff: next });
  };

  const [drawingCardId, setDrawingCardId] = useState(null);
  const [playingCardId, setPlayingCardId] = useState(null);

  // When a card is clicked in the game UI, emit the move to the server if it's the player's turn.
  const handleCardClick = (card) => {
    if (!gameState) return;
    if (!gameState.isYourTurn) {
      setSyncStatus("It's not your turn!");
      return;
    }
    playSound(cardPlaySound);
    if (card.value === "A") {
      setPendingWild(card);
      return;
    }
    setPlayingCardId(card.id);
    setTimeout(() => {
      setPlayingCardId(null);
      socket.emit("send-move", { room, cardId: card.id, action: "play" });
    }, 250);
  };

  const handleSuitChosen = (suit) => {
    if (!pendingWild) return;
    const card = pendingWild;
    setPendingWild(null);
    setPlayingCardId(card.id);
    setTimeout(() => {
      setPlayingCardId(null);
      socket.emit("send-move", {
        room,
        cardId: card.id,
        action: "play",
        chosenSuit: suit,
      });
    }, 250);
  };

  // For games that allow drawing a card instead of playing
  // this function emits a draw action to the server.
  const handleDraw = () => {
    if (!gameState) return;
    if (!gameState.isYourTurn) {
      setSyncStatus("It's not your turn!");
      return;
    }
    socket.emit("send-move", { room, action: "draw" });
  };

  // blackjack — take another card. server enforces that you must be "playing" status
  const handleHit = () => {
    if (!gameState) return
    socket.emit('send-move', { room, action: 'hit' })
    playSound(cardPlaySound)
  }

  // blackjack — lock in your score
  const handleStand = () => {
    if (!gameState) return
    socket.emit('send-move', { room, action: 'stand' })
  }

  // blackjack — double the bet, draw exactly 1 card, auto-stand
  const handleDouble = () => {
    if (!gameState) return
    socket.emit('send-move', { room, action: 'double' })
    playSound(cardPlaySound)
  }

  // blackjack — place a bet for this round
  const handleBet = (amount) => {
    if (!gameState) return
    socket.emit('send-move', { room, action: 'bet', amount })
  }

  // blackjack — start a fresh round after one ended
  const handleNextRound = () => {
    if (!gameState) return
    socket.emit('send-move', { room, action: 'next-round' })
  }

  // local-only — how much the user is about to bet (slider state)
  const [betAmount, setBetAmount] = useState(50)

  // keep betAmount valid as chips change between rounds. min bet is 10, max is whatever
  // the player has. without this, after losing rounds the user can end up with a
  // betAmount that's bigger than their chips, and the "Place bet" button is permanently
  // disabled. similar story when gameState is briefly null right after picking Blackjack
  useEffect(() => {
    if (gameMode !== 'blackjack' || !gameState?.chips) return
    const chips = gameState.chips[socket.id]
    if (typeof chips !== 'number') return
    if (chips < 10) return // out-of-chips handled separately
    setBetAmount(prev => {
      const clamped = Math.max(10, Math.min(prev, chips))
      return clamped
    })
  }, [gameMode, gameState?.chips?.[socket.id]])

  // briefly flash a "Your turn!" banner each time a fresh Blackjack round starts
  // (so you notice the deal). both players play in parallel against the dealer
  const [turnFlash, setTurnFlash] = useState(0)
  const prevCanActRef = useRef(false)
  useEffect(() => {
    const canActNow = gameMode === 'blackjack'
      && gameState?.phase === 'playing'
      && gameState?.status?.[socket.id] === 'playing'
    if (canActNow && !prevCanActRef.current) {
      setTurnFlash(c => c + 1)
    }
    prevCanActRef.current = canActNow
  }, [gameState, gameMode, socket.id])

  // styles reused inside the settings dropdown / rules modal
  const settingsItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.85)",
    fontSize: "13px",
    cursor: "pointer",
    borderRadius: "8px",
    textAlign: "left",
    fontFamily: "'Inter', sans-serif",
  };

  const rulesSectionStyle = {
    fontFamily: "'Syne', sans-serif",
    fontSize: "13px",
    color: "var(--neon-purple)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginTop: "18px",
    marginBottom: "8px",
  };
  const rulesListStyle = {
    color: "rgba(255,255,255,0.7)",
    fontSize: "13px",
    lineHeight: "1.7",
    paddingLeft: "18px",
    margin: 0,
  };

  const copyRoom = () => {
    const link = `${window.location.origin}?room=${room}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── GROQ AI Assistant ─────────────────────────────────────
  const askAI = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    try {
      // build a per-game context payload so the assistant has the actual numbers in front of it
      const context = { playerNames: Object.values(nicknames).join(' vs ') }

      if (gameMode === 'lastcard' && gameState) {
        const top = gameState.discard?.[gameState.discard.length - 1]
        context.handSize     = gameState.hands?.[socket.id]?.length
        context.topCard      = top ? `${top.value}${top.suit}` : undefined
        context.declaredSuit = gameState.currSuit
        context.drawStack    = gameState.drawStack
        context.yourTurn     = gameState.isYourTurn
      } else if (gameMode === 'blackjack' && gameState) {
        const dealerUp = gameState.dealerHand?.[0]
        context.phase        = gameState.phase
        context.yourScore    = gameState.scores?.[socket.id]
        context.yourCards    = gameState.hands?.[socket.id]?.length
        context.yourChips    = gameState.chips?.[socket.id]
        context.yourBet      = gameState.bets?.[socket.id]
        context.yourStatus   = gameState.status?.[socket.id]
        context.dealerUpcard = dealerUp ? `${dealerUp.value}${dealerUp.suit}` : undefined
      }

      // calls our server, not Groq directly
      const backendUrl = window.location.hostname === 'localhost' 
        ? '' 
        : 'https://acetime-backend.onrender.com';

      const response = await fetch(`${backendUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          game: gameMode,
          context,
        })
      })
  
      if (response.status === 429) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: "I'm being rate limited — please wait 30 seconds and try again."
        }])
        return
      }
  
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
  
      const data = await response.json()
      const aiText = data.text ?? "Sorry, I couldn't get a response."
  
      setChatMessages(prev => [...prev, { role: 'assistant', text: aiText }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  
    } catch (err) {
      console.error('AI error:', err)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: "Something went wrong. Please try again."
      }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#05050a",
        overflow: "hidden",
      }}
    >
      {/* ── MODE: VIDEO CALL (no game) ── */}
      {gameMode === "call" && (
        <>
          {/* Friend's face — full screen */}
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            {!isOpponentJoined ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  background: "#08080f",
                }}
              >
                <div className="waiting-pulse" />
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Waiting for opponent...
                </p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>
                  Share room code:{" "}
                  <span
                    style={{ color: "var(--neon-blue)", letterSpacing: "2px" }}
                  >
                    {room}
                  </span>
                </p>
              </div>
            ) : isOpponentCameraOff ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  background: "#08080f",
                }}
              >
                <Avatar name={opponentNickname} size={100} />
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
                  {opponentNickname} turned off camera
                </p>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>

          {/* My cam — bottom right corner */}
          <div
            style={{
              position: "absolute",
              bottom: "140px",
              right: "20px",
              width: "160px",
              height: "120px",
              borderRadius: "14px",
              overflow: "hidden",
              border: `2px solid ${accent}66`,
              background: "#05050a",
              zIndex: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            }}
          >
            {cameraError ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0d0b10",
                  padding: "8px",
                  textAlign: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "20px" }}>🚫</span>
                <span
                  style={{
                    fontSize: "9px",
                    color: "#ff6b6b",
                    lineHeight: "1.3",
                  }}
                >
                  {cameraError}
                </span>
              </div>
            ) : isCameraOff ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "#0d0b10",
                }}
              >
                <Avatar name={myNickname} size={40} />
                <span
                  style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}
                >
                  Camera off
                </span>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                }}
              />
            )}
            <div
              className="name-tag"
              style={{ fontSize: "10px", padding: "2px 8px" }}
            >
              {myNickname} (you)
            </div>
          </div>

          {/* Room strip — top left */}
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div className="room-strip">
              <span className="room-strip-label">Room</span>
              <span className="room-strip-id">{room}</span>
              <button
                className={`room-strip-copy ${copied ? "copied" : ""}`}
                onClick={copyRoom}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Controls — bottom centre */}
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "10px",
              zIndex: 20,
            }}
          >
            <button
              className={`control-btn ${isMuted ? "active" : ""}`}
              onClick={toggleMute}
            >
              <img src={Mute} alt="Mute" />
            </button>
            <button
              className={`control-btn ${isCameraOff ? "active" : ""}`}
              onClick={toggleCamera}
            >
              <img src={VideoOff} alt="Camera" />
            </button>
            <button
              className={`control-btn ${chatOpen ? "active" : ""}`}
              onClick={() => setChatOpen((p) => !p)}
              style={{
                fontSize: "18px",
                backgroundColor: chatOpen ? "rgba(180,77,255,0.3)" : "",
              }}
            >
              🤖
            </button>
            <button className="control-btn end-call" onClick={onLeave}>
              <img src={EndCall} alt="End" />
            </button>
          </div>

          {/* Game menu button — top right */}
          <button
            onClick={() => setGameMode("menu")}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 20,
              padding: "10px 20px",
              background:
                "linear-gradient(135deg, var(--neon-purple), var(--neon-blue))",
              border: "none",
              borderRadius: "980px",
              color: "white",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              boxShadow: "0 0 20px rgba(180,77,255,0.4)",
              marginTop: 0,
            }}
          >
            🎮 Play Games
          </button>
        </>
      )}

      {/* ── MODE: GAME MENU ── */}
      {gameMode === "menu" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            background: "rgba(5,5,8,0.96)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
            padding: "40px",
          }}
        >
          {/* Back button */}
          <button
            onClick={() => setGameMode("call")}
            style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              padding: "8px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px",
              color: "rgba(255,255,255,0.6)",
              fontSize: "13px",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              marginTop: 0,
            }}
          >
            ← Back to call
          </button>

          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "32px",
                fontWeight: "800",
                color: "white",
                marginBottom: "8px",
              }}
            >
              Choose a Game
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
              {isHost
                ? isOpponentJoined
                  ? "Pick a game — your opponent will join automatically"
                  : "Waiting for opponent before you can start..."
                : "Waiting for host to pick a game..."}
            </p>
          </div>

          {/* game cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            width: '100%',
            maxWidth: '760px',
          }}>
            {GAMES.map(game => (
              <div
                key={game.id}
                onClick={() => {
                  if (!game.available || !isHost || !isOpponentJoined) return;
                  console.log("clicking game:", game.id);
                  socket.emit("game-selected", { room, game: game.id });
                }}
                style={{
                  borderRadius: "16px",
                  border: `1px solid ${game.available && isHost && isOpponentJoined ? game.border : "rgba(255,255,255,0.07)"}`,
                  background:
                    game.available && isHost && isOpponentJoined
                      ? game.color
                      : "rgba(255,255,255,0.02)",
                  padding: "28px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "14px",
                  cursor:
                    game.available && isHost && isOpponentJoined
                      ? "pointer"
                      : "not-allowed",
                  opacity: game.available ? 1 : 0.4,
                  transition: "all 0.2s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Big emoji as the "image" */}
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "44px",
                  }}
                >
                  {game.emoji}
                </div>

                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "white",
                      marginBottom: "6px",
                    }}
                  >
                    {game.name}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      lineHeight: "1.4",
                    }}
                  >
                    {game.description}
                  </p>
                </div>

                {!game.available && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.3)",
                      background: "rgba(255,255,255,0.06)",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    Soon
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE: LAST CARD GAME ── */}
      {gameMode === "lastcard" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            ...backgrounds[bgIndex],
            background: backgrounds[bgIndex].bg,
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ${backgrounds[bgIndex].bg}`,
            backgroundSize: "28px 28px, 100% 100%",
          }}
        >
          {/* Decorative suits */}
          <div className="table-suits">
            <span className="table-suit" style={{ color: accent }}>
              {backgrounds[bgIndex].suits[0]}
            </span>
            <span className="table-suit" style={{ color: accent }}>
              {backgrounds[bgIndex].suits[1]}
            </span>
          </div>
          <span className="corner tl" style={{ color: accent }} />
          <span className="corner tr" style={{ color: accent }} />
          <span className="corner bl" style={{ color: accent }} />
          <span className="corner br" style={{ color: accent }} />

          {/* Game area — leaves space at bottom for cams */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: "140px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "20px 30px",
              boxSizing: "border-box",
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              {/* CHANGED: Turn indicator moved to top-centre as large white text, last action below */}
              <div
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  textAlign: "center",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "22px",
                    fontWeight: "700",
                    color: "white",
                    margin: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {gameState
                    ? gameState.isYourTurn
                      ? `Your turn, ${myNickname}`
                      : `${opponentNickname}'s turn`
                    : syncStatus}
                </p>
                {/* ADDED: Last action log — smaller and muted to distinguish from turn text */}
                {gameState && syncStatus && (
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.45)",
                      margin: "4px 0 0 0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {syncStatus}
                  </p>
                )}
              </div>
              {/* spacer so settings buttons stay right-aligned */}
              <div />
              <div
                style={{ display: "flex", gap: "8px", position: "relative" }}
              >
                <button
                  onClick={() => setShowRules(true)}
                  title="How to play"
                  style={{
                    width: "32px",
                    height: "32px",
                    padding: 0,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.8)",
                    borderRadius: "50%",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  ?
                </button>
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  title="Settings"
                  style={{
                    width: "32px",
                    height: "32px",
                    padding: 0,
                    background: showSettings
                      ? "rgba(180,77,255,0.25)"
                      : "rgba(0,0,0,0.35)",
                    border: `1px solid ${showSettings ? "rgba(180,77,255,0.5)" : "rgba(255,255,255,0.12)"}`,
                    color: "rgba(255,255,255,0.8)",
                    borderRadius: "50%",
                    fontSize: "14px",
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  ⚙
                </button>

                {showSettings && (
                  <div
                    style={{
                      position: "absolute",
                      top: "40px",
                      right: 0,
                      zIndex: 60,
                      minWidth: "180px",
                      background: "rgba(15,15,26,0.97)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      padding: "6px",
                      boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <button
                      onClick={() => {
                        setBgIndex((p) => (p + 1) % backgrounds.length);
                      }}
                      style={settingsItemStyle}
                    >
                      🎨 <span>Cycle theme</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setGameMode("menu");
                      }}
                      style={settingsItemStyle}
                    >
                      🎮 <span>Change game</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setGameMode("call");
                      }}
                      style={settingsItemStyle}
                    >
                      📞 <span>Back to call</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Opponent hand */}
            <div>
              <p className="hand-label">{opponentNickname}'s hand</p>
              <div className="opponent-hand">
                {gameState
                  ? Object.keys(gameState.hands)
                      .filter((id) => id !== socket.id)
                      .map((oppId) => {
                        const cardCount =
                          typeof gameState.hands[oppId] === "number"
                            ? gameState.hands[oppId]
                            : gameState.hands[oppId].length;
                        return Array.from({ length: cardCount }).map((_, i) => (
                          <div key={i} className="card card-back" />
                        ));
                      })
                  : null}
              </div>
            </div>

            {/* 3 columns so the discard pile stays in the centre of the screen.
                draw pile lives in the left col, right col is just a spacer */}
            <div
              className="game-table"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: "24px",
                alignItems: "flex-start",
                width: "100%",
              }}
            >
              {/* left column: draw pile (pushed to the right side of its col) */}
              {gameState ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <p className="discard-label" style={{ margin: 0 }}>
                      Draw pile
                    </p>
                    <div
                      onClick={() => gameState.isYourTurn && handleDraw()}
                      style={{
                        position: "relative",
                        width: "72px",
                        height: "100px",
                        cursor: gameState.isYourTurn ? "pointer" : "default",
                      }}
                    >
                      {/* stack up to 3 card-backs to make the pile look like a stack */}
                      {gameState.deckCount > 0 &&
                        [0, 1, 2]
                          .slice(
                            0,
                            Math.min(3, Math.ceil(gameState.deckCount / 8)),
                          )
                          .map((i) => (
                            <div
                              key={i}
                              className="card card-back"
                              style={{
                                position: "absolute",
                                top: -i * 2,
                                left: i * 2,
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          ))}
                      {gameState.deckCount === 0 && (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "1px dashed rgba(255,255,255,0.15)",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.25)",
                            fontSize: "10px",
                          }}
                        >
                          empty
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.5)",
                        background: "rgba(0,0,0,0.45)",
                        padding: "2px 10px",
                        borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {gameState.deckCount} left
                    </span>
                  </div>
                </div>
              ) : (
                <div />
              )}

              {/* middle column — discard pile + suit indicator + the play/draw buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <p className="discard-label" style={{ margin: 0 }}>
                  Discard pile
                </p>
                {gameState ? (
                  <Card
                    card={gameState.discard[gameState.discard.length - 1]}
                    disabled={true}
                  />
                ) : (
                  <div className="card-placeholder">Waiting…</div>
                )}
                {gameState && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.5)",
                      background: "rgba(0,0,0,0.45)",
                      padding: "2px 10px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {gameState.discard.length} played
                  </span>
                )}

                {/* shows the "active" suit. highlights yellow when an Ace was used
                  to declare a different suit than the top card you can see */}
                {gameState &&
                  (() => {
                    const top = gameState.discard[gameState.discard.length - 1];
                    const declared = gameState.currSuit;
                    const differs = top && top.suit !== declared;
                    const isRed = declared === "♥" || declared === "♦";
                    return (
                      <div
                        style={{
                          marginTop: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 12px",
                          background: differs
                            ? "rgba(255,215,0,0.15)"
                            : "rgba(255,255,255,0.05)",
                          border: `1px solid ${differs ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: "12px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          {differs ? "Declared suit:" : "Current suit:"}
                        </span>
                        <span
                          style={{
                            fontSize: "18px",
                            color: isRed ? "#ff4d4d" : "#ffffff",
                          }}
                        >
                          {declared}
                        </span>
                      </div>
                    );
                  })()}

                {/* you have to say Last Card before playing your 2nd-to-last card */}
                {gameState &&
                  gameState.hands[socket.id]?.length === 2 &&
                  !lastCardCalled && (
                    <button
                      onClick={() => {
                        socket.emit("call-last-card", { room });
                        setLastCardCalled(true);
                      }}
                      style={{
                        marginTop: "10px",
                        padding: "8px 22px",
                        background: "linear-gradient(135deg, #ff3dac, #b44dff)",
                        border: "none",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "white",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: "0 0 16px rgba(255,61,172,0.5)",
                      }}
                    >
                      🃏 Last Card!
                    </button>
                  )}

                {/* catch the opponent if they forgot. button disappears once you make your move */}
                {callableOpponent && callableOpponent !== socket.id && (
                  <button
                    onClick={() => socket.emit("call-out-opponent", { room })}
                    style={{
                      marginTop: "10px",
                      padding: "8px 22px",
                      background: "linear-gradient(135deg, #ffd700, #ff6b35)",
                      border: "none",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#1a1000",
                      cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      boxShadow: "0 0 18px rgba(255,215,0,0.55)",
                    }}
                  >
                    ⚠️ Catch! They forgot Last Card
                  </button>
                )}
                {gameState &&
                  gameState.isYourTurn &&
                  (() => {
                    // ADDED: compute whether any card is playable so we can highlight draw when none are JB
                    const topCard =
                      gameState.discard[gameState.discard.length - 1];
                    const drawStack = gameState.drawStack ?? 0;
                    const hasAnyPlayable = gameState.hands[socket.id]?.some(
                      (card) => {
                        if (card.value === "A") return true;
                        if (drawStack > 0)
                          return card.value === "2" || card.value === "3";
                        return (
                          card.suit === gameState.currSuit ||
                          card.value === topCard.value
                        );
                      },
                    );
                    // ADDED: when no card can be played, glow the draw button so the player knows what to do JB
                    const mustDraw = !hasAnyPlayable;
                    return (
                      <button
                        onClick={handleDraw}
                        style={{
                          marginTop: "8px",
                          padding: "8px 22px",
                          background: mustDraw
                            ? `${accent}22`
                            : "rgba(255,255,255,0.08)",
                          border: mustDraw
                            ? `1px solid ${accent}`
                            : "1px solid rgba(255,255,255,0.15)",
                          color: "white",
                          borderRadius: "20px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                          marginBottom: 0,
                          boxShadow: mustDraw ? `0 0 12px ${accent}66` : "none",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {mustDraw ? "⬆ Draw card" : "Draw card"}
                      </button>
                    );
                  })()}
              </div>

              {/* right col is empty on purpose - it balances the grid */}
              <div />
            </div>

            {/* Your hand */}
            <div>
              <p className="hand-label">Your hand</p>
              <div className="player-hand">
                {gameState && gameState.hands[socket.id] ? (
                  (() => {
                    const topCard =
                      gameState.discard[gameState.discard.length - 1];
                    const currSuit = gameState.currSuit;
                    const drawStack = gameState.drawStack ?? 0;

                    // ADDED: determine which cards are legally playable this turn
                    const isPlayable = (card) => {
                      if (card.value === "A") return true;
                      if (drawStack > 0)
                        return card.value === "2" || card.value === "3";
                      return (
                        card.suit === currSuit || card.value === topCard.value
                      );
                    };

                    // ADDED: check if ANY card in hand can be played (used to highlight draw button)
                    const hasAnyPlayable =
                      gameState.hands[socket.id].some(isPlayable);

                    return (
                      <>
                        {gameState.hands[socket.id].map((card) => (
                          // ADDED: pass disabled=true for unplayable cards so Card greys them out
                          <Card
                            key={card.id}
                            card={card}
                            onClick={() => handleCardClick(card)}
                            disabled={
                              !gameState.isYourTurn || !isPlayable(card)
                            }
                            className={
                              card.id === playingCardId
                                ? "card-play"
                                : card.id === drawingCardId
                                  ? "card-draw"
                                  : ""
                            }
                          />
                        ))}
                      </>
                    );
                  })()
                ) : (
                  <p
                    style={{
                      color: "rgba(255,255,255,0.25)",
                      fontSize: "13px",
                    }}
                  >
                    Waiting for players...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Camera strip — bottom centre */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "12px",
              zIndex: 50,
            }}
          >
            {/* Friend cam */}
            <div
              style={{
                width: "150px",
                height: "110px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.15)",
                background: "#05050a",
                position: "relative",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {isOpponentCameraOff ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0d0b10",
                  }}
                >
                  <Avatar name={opponentNickname} size={36} />
                </div>
              ) : (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: "4px",
                  left: "6px",
                  fontSize: "10px",
                  color: "white",
                  background: "rgba(0,0,0,0.6)",
                  padding: "2px 6px",
                  borderRadius: "6px",
                }}
              >
                {opponentNickname}
              </div>
            </div>

            {/* My cam */}
            <div
              style={{
                width: "150px",
                height: "110px",
                borderRadius: "12px",
                overflow: "hidden",
                border: `2px solid ${accent}55`,
                background: "#05050a",
                position: "relative",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {isCameraOff ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0d0b10",
                  }}
                >
                  <Avatar name={myNickname} size={36} />
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: "4px",
                  left: "6px",
                  fontSize: "10px",
                  color: "white",
                  background: "rgba(0,0,0,0.6)",
                  padding: "2px 6px",
                  borderRadius: "6px",
                }}
              >
                {myNickname} (you)
              </div>
            </div>
          </div>

          {/* Controls in game */}
          <div
            style={{
              position: "absolute",
              bottom: "140px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "10px",
              zIndex: 50,
            }}
          >
            <button
              className={`control-btn ${isMuted ? "active" : ""}`}
              onClick={toggleMute}
            >
              <img src={Mute} alt="Mute" />
            </button>
            <button
              className={`control-btn ${isCameraOff ? "active" : ""}`}
              onClick={toggleCamera}
            >
              <img src={VideoOff} alt="Camera" />
            </button>
            <button
              className={`control-btn ${chatOpen ? "active" : ""}`}
              onClick={() => setChatOpen((p) => !p)}
              style={{
                fontSize: "18px",
                backgroundColor: chatOpen ? "rgba(180,77,255,0.3)" : "",
              }}
              title="Game assistant"
            >
              🤖
            </button>
            <button className="control-btn end-call" onClick={onLeave}>
              <img src={EndCall} alt="End" />
            </button>
          </div>
        </div>
      )}


      {/* ── MODE: BLACKJACK ── */}
      {gameMode === 'blackjack' && (() => {
        const opponentId = gameState
          ? Object.keys(gameState.hands || {}).find(id => id !== socket.id)
          : null
        const myHand    = gameState?.hands?.[socket.id] || []
        const myScore   = gameState?.scores?.[socket.id] ?? 0
        const myStatus  = gameState?.status?.[socket.id] ?? 'waiting'
        const myBet     = gameState?.bets?.[socket.id] ?? 0
        const myChips   = gameState?.chips?.[socket.id] ?? 0
        const oppHandSize = opponentId
          ? (typeof gameState.hands[opponentId] === 'number'
              ? gameState.hands[opponentId]
              : (gameState.hands[opponentId]?.length ?? 0))
          : 0
        const oppStatus = opponentId ? gameState?.status?.[opponentId] : null
        const oppBet    = opponentId ? (gameState?.bets?.[opponentId] ?? 0) : 0
        const oppChips  = opponentId ? (gameState?.chips?.[opponentId] ?? 0) : 0
        const phase     = gameState?.phase ?? 'betting'
        const dealerHand  = gameState?.dealerHand || []
        const dealerScore = gameState?.dealerScore ?? 0
        const myResult  = gameState?.results?.[socket.id]
        const oppResult = opponentId ? gameState?.results?.[opponentId] : null

        const statusChip = (s, result) => {
          if (result === 'blackjack') return { text: 'Blackjack! +3:2', color: '#ffd700' }
          if (result === 'win')       return { text: 'Won', color: '#00ffb3' }
          if (result === 'lose')      return { text: 'Lost', color: '#ff6b6b' }
          if (result === 'push')      return { text: 'Push', color: 'rgba(255,255,255,0.7)' }
          if (result === 'bust')      return { text: 'Bust', color: '#ff6b6b' }
          if (s === 'busted')   return { text: 'Busted', color: '#ff6b6b' }
          if (s === 'blackjack')return { text: 'Blackjack!', color: '#ffd700' }
          if (s === 'standing') return { text: 'Standing', color: '#00ffb3' }
          if (s === 'playing')  return { text: 'Playing…', color: 'rgba(255,255,255,0.7)' }
          return { text: 'Waiting', color: 'rgba(255,255,255,0.5)' }
        }

        const canDouble = phase === 'playing'
          && myStatus === 'playing'
          && myHand.length === 2
          && myChips >= myBet

        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'radial-gradient(circle at 50% 50%, #0a2a1a 0%, #04100a 100%)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(circle at 50% 50%, #0a2a1a 0%, #04100a 100%)',
            backgroundSize: '28px 28px, 100% 100%',
          }}>
            {/* header */}
            <div style={{
              position: 'absolute', top: '20px', left: '30px', right: '30px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5,
            }}>
              <div
                className={`status-pill ${
                  phase === 'playing' && myStatus === 'playing' ? 'status-blink' : ''
                }`}
                style={{ color: '#00d4ff' }}
              >
                <span className="status-dot" style={{ backgroundColor: '#00d4ff' }} />
                {phase === 'betting'    ? 'Place your bet'
                 : phase === 'resolved' ? 'Round over'
                 : myStatus === 'playing' ? '🟢 Your move'
                 : oppStatus === 'playing' ? `⏳ ${opponentNickname} still playing…`
                 : 'Dealer playing…'}
              </div>
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <button onClick={() => setShowRules(true)} title="How to play" style={{
                  width: '32px', height: '32px', padding: 0,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.8)', borderRadius: '50%',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                }}>?</button>
                <button onClick={() => setShowSettings(s => !s)} title="Settings" style={{
                  width: '32px', height: '32px', padding: 0,
                  background: showSettings ? 'rgba(180,77,255,0.25)' : 'rgba(0,0,0,0.35)',
                  border: `1px solid ${showSettings ? 'rgba(180,77,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: 'rgba(255,255,255,0.8)', borderRadius: '50%',
                  fontSize: '14px', cursor: 'pointer',
                }}>⚙</button>
                {showSettings && (
                  <div style={{
                    position: 'absolute', top: '40px', right: 0, zIndex: 60,
                    minWidth: '180px',
                    background: 'rgba(15,15,26,0.97)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', padding: '6px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                  }}>
                    <button onClick={() => { setShowSettings(false); setGameMode('menu') }} style={settingsItemStyle}>🎮 <span>Change game</span></button>
                    <button onClick={() => { setShowSettings(false); setGameMode('call') }} style={settingsItemStyle}>📞 <span>Back to call</span></button>
                  </div>
                )}
              </div>
            </div>

            {/* opponent strip — chips/bet/status only. their hand is hidden */}
            <div style={{
              position: 'absolute', top: '70px', left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '8px 16px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              zIndex: 5,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: '600' }}>
                {opponentNickname}
              </span>
              <span style={{ color: '#ffd700', fontSize: '12px' }}>💰 {oppChips}</span>
              {oppBet > 0 && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Bet {oppBet}</span>}
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>· {oppHandSize} cards</span>
              <span style={{
                fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
                color: statusChip(oppStatus, oppResult).color,
                padding: '2px 8px', borderRadius: '8px',
                border: `1px solid ${statusChip(oppStatus, oppResult).color}55`,
              }}>
                {statusChip(oppStatus, oppResult).text}
              </span>
            </div>

            {/* dealer area */}
            <div style={{
              position: 'absolute', top: '130px', left: 0, right: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="hand-label" style={{ margin: 0 }}>Dealer</span>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: '800',
                  color: dealerScore > 21 ? '#ff6b6b' : 'white',
                }}>
                  {dealerHand.length > 0 ? dealerScore : '—'}
                  {gameState?.dealerHoleHidden && dealerHand.length > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginLeft: '4px' }}>+ ?</span>
                  )}
                </span>
                {dealerScore > 21 && <span style={{ fontSize: '10px', color: '#ff6b6b', textTransform: 'uppercase' }}>Dealer bust</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {dealerHand.length === 0
                  ? <div className="card-placeholder" />
                  : dealerHand.map((card, i) => (
                      card.hidden
                        ? <div key={'hole-' + i} className="card card-back card-deal" />
                        : <div key={card.id || 'd' + i} className="card-deal">
                            <Card card={card} disabled={true} />
                          </div>
                    ))}
              </div>
            </div>

            {/* your area */}
            <div style={{
              position: 'absolute', bottom: '160px', left: 0, right: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="hand-label" style={{ margin: 0 }}>You</span>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: '800',
                  color: myScore > 21 ? '#ff6b6b' : 'white',
                }}>
                  {myHand.length > 0 ? myScore : '—'}
                </span>
                <span style={{
                  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
                  color: statusChip(myStatus, myResult).color,
                  padding: '2px 8px', borderRadius: '8px',
                  border: `1px solid ${statusChip(myStatus, myResult).color}55`,
                }}>
                  {statusChip(myStatus, myResult).text}
                </span>
                <span style={{ color: '#ffd700', fontSize: '12px' }}>💰 {myChips}</span>
                {myBet > 0 && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Bet {myBet}</span>}
              </div>
              <div
                className={
                  phase === 'playing' && myStatus === 'playing' ? 'turn-active' : ''
                }
                style={{ display: 'flex', gap: '8px' }}
              >
                {myHand.length === 0
                  ? <div className="card-placeholder" />
                  : myHand.map(card => (
                      <div key={card.id} className="card-deal">
                        <Card card={card} disabled={true} />
                      </div>
                    ))}
              </div>

              {/* ── betting phase ──
                  three sub-cases:
                    (a) Blackjack state not yet loaded → loading spinner
                    (b) player is broke (chips < 10) → "out of chips" recovery
                    (c) normal: show the bet selector */}
              {phase === 'betting' && !gameState?.bets?.[socket.id] && (() => {
                // (a) state hasn't arrived yet — wait for game-init / game-state-update
                if (!gameState || gameState.selectedGame !== 'Blackjack' || typeof myChips !== 'number') {
                  return (
                    <p style={{ marginTop: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                      Loading round…
                    </p>
                  )
                }

                // (b) out of chips — give them a way out
                if (myChips < 10) {
                  return (
                    <div style={{
                      marginTop: '12px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '10px',
                      background: 'rgba(255,107,107,0.1)', padding: '14px 22px',
                      borderRadius: '14px', border: '1px solid rgba(255,107,107,0.35)',
                    }}>
                      <p style={{ color: '#ff6b6b', fontSize: '13px', margin: 0, fontWeight: '600' }}>
                        You're out of chips!
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', margin: 0, textAlign: 'center' }}>
                        Pick Blackjack again from the menu to start over with 500 chips.
                      </p>
                      <button
                        onClick={() => setGameMode('menu')}
                        style={{
                          padding: '8px 18px', borderRadius: '20px',
                          background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                          border: 'none', color: 'white', fontWeight: '600', fontSize: '12px',
                          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Back to menu
                      </button>
                    </div>
                  )
                }

                // (c) normal bet selector. all changes clamp to [10, myChips] so the
                // amount can never end up in a state where you can't press Place bet
                const clamp = (v) => Math.max(10, Math.min(myChips, v))
                const canPlace = betAmount >= 10 && betAmount <= myChips
                return (
                  <div style={{
                    marginTop: '12px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '10px',
                    background: 'rgba(0,0,0,0.45)', padding: '14px 22px',
                    borderRadius: '14px', border: '1px solid rgba(0,212,255,0.3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setBetAmount(clamp(betAmount - 10))}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: 'white', fontSize: '16px', cursor: 'pointer',
                        }}>−</button>
                      <span style={{
                        fontFamily: "'Syne', sans-serif", fontSize: '28px', fontWeight: '800',
                        color: '#ffd700', minWidth: '70px', textAlign: 'center',
                      }}>{betAmount}</span>
                      <button
                        onClick={() => setBetAmount(clamp(betAmount + 10))}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: 'white', fontSize: '16px', cursor: 'pointer',
                        }}>+</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[10, 25, 50, 100].map(v => (
                        <button key={v}
                          onClick={() => setBetAmount(clamp(v))}
                          disabled={v > myChips}
                          style={{
                            padding: '4px 10px', fontSize: '11px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: v > myChips ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                            borderRadius: '8px',
                            cursor: v > myChips ? 'not-allowed' : 'pointer',
                          }}>{v}</button>
                      ))}
                      <button
                        onClick={() => setBetAmount(myChips)}
                        disabled={myChips < 10}
                        style={{
                          padding: '4px 10px', fontSize: '11px',
                          background: 'rgba(255,215,0,0.12)',
                          border: '1px solid rgba(255,215,0,0.35)',
                          color: '#ffd700',
                          borderRadius: '8px', cursor: 'pointer',
                        }}>all in</button>
                    </div>
                    <button
                      onClick={() => handleBet(betAmount)}
                      disabled={!canPlace}
                      style={{
                        padding: '10px 28px', borderRadius: '22px',
                        background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
                        border: 'none', color: '#1a1000',
                        fontWeight: '700', fontSize: '13px',
                        cursor: canPlace ? 'pointer' : 'not-allowed',
                        opacity: canPlace ? 1 : 0.5,
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: '0 0 18px rgba(255,215,0,0.4)',
                      }}>Place bet · {betAmount}</button>
                  </div>
                )
              })()}

              {phase === 'betting' && gameState?.bets?.[socket.id] && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '12px' }}>
                  Waiting for {opponentNickname} to bet…
                </p>
              )}

              {/* ── playing phase — buttons appear for whichever player is still "playing".
                  both can act in parallel; the dealer plays once both are done ── */}
              {phase === 'playing' && myStatus === 'playing' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button onClick={handleHit} style={{
                    padding: '10px 24px', borderRadius: '22px',
                    background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
                    border: 'none', color: 'white',
                    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: '0 0 16px rgba(0,212,255,0.4)',
                  }}>Hit</button>
                  <button onClick={handleStand} style={{
                    padding: '10px 24px', borderRadius: '22px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', fontWeight: '700', fontSize: '13px',
                    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  }}>Stand</button>
                  {canDouble && (
                    <button onClick={handleDouble} style={{
                      padding: '10px 24px', borderRadius: '22px',
                      background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
                      border: 'none', color: '#1a1000',
                      fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                    }}>Double</button>
                  )}
                </div>
              )}

              {/* ── resolved phase ── */}
              {phase === 'resolved' && (
                <button onClick={handleNextRound} style={{
                  marginTop: '12px',
                  padding: '12px 32px', borderRadius: '22px',
                  background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                  border: 'none', color: 'white',
                  fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: '0 0 18px rgba(180,77,255,0.4)',
                }}>Next round</button>
              )}
            </div>

            {/* camera strip */}
            <div style={{
              position: 'absolute', bottom: '20px', left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', gap: '12px', zIndex: 50,
            }}>
              <div style={{
                width: '150px', height: '110px',
                borderRadius: '12px', overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.15)',
                background: '#05050a', position: 'relative',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                {isOpponentCameraOff ? (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
                    <Avatar name={opponentNickname} size={36} />
                  </div>
                ) : (
                  <video ref={remoteVideoRef} autoPlay playsInline
                    style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                )}
                <div style={{ position:'absolute', bottom:'4px', left:'6px', fontSize:'10px', color:'white', background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:'6px' }}>
                  {opponentNickname}
                </div>
              </div>
              <div style={{
                width: '150px', height: '110px',
                borderRadius: '12px', overflow: 'hidden',
                border: '2px solid rgba(0,212,255,0.4)',
                background: '#05050a', position: 'relative',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                {isCameraOff ? (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0b10' }}>
                    <Avatar name={myNickname} size={36} />
                  </div>
                ) : (
                  <video ref={localVideoRef} autoPlay muted playsInline
                    style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
                )}
                <div style={{ position:'absolute', bottom:'4px', left:'6px', fontSize:'10px', color:'white', background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:'6px' }}>
                  {myNickname} (you)
                </div>
              </div>
            </div>

            {/* call controls — moved to the left edge so they don't sit on top
                of the game area. compact pill, vertically centred */}
            <div style={{
              position: 'absolute', top: '50%', left: '20px',
              transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50,
              padding: '8px',
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              backdropFilter: 'blur(8px)',
            }}>
              <button className={`control-btn compact ${isMuted ? 'active' : ''}`} onClick={toggleMute} title="Mute">
                <img src={Mute} alt="Mute" />
              </button>
              <button className={`control-btn compact ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title="Camera">
                <img src={VideoOff} alt="Camera" />
              </button>
              <button
                className={`control-btn compact ${chatOpen ? 'active' : ''}`}
                onClick={() => setChatOpen(p => !p)}
                style={{ fontSize: '16px', backgroundColor: chatOpen ? 'rgba(180,77,255,0.3)' : '' }}
                title="Game assistant"
              >
                🤖
              </button>
              <button className="control-btn compact end-call" onClick={onLeave} title="Leave">
                <img src={EndCall} alt="End" />
              </button>
            </div>

            {/* "your turn!" banner — re-fires each new deal so you know you can act */}
            {turnFlash > 0 && phase === 'playing' && myStatus === 'playing' && (
              <div key={turnFlash} className="turn-banner">
                🟢 Your move!
              </div>
            )}
          </div>
        )
      })()}

      {/* ── SUIT PICKER (shown after playing a Jack) ── */}
      {pendingWild && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            background: "rgba(5,5,10,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <p
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "20px",
              fontWeight: "700",
              color: "white",
            }}
          >
            Choose a suit for your Ace
          </p>
          <div style={{ display: "flex", gap: "16px" }}>
            {[
              { suit: "♠", label: "Spades", color: "#ffffff" },
              { suit: "♥", label: "Hearts", color: "#ff4d4d" },
              { suit: "♦", label: "Diamonds", color: "#ff4d4d" },
              { suit: "♣", label: "Clubs", color: "#ffffff" },
            ].map(({ suit, label, color }) => (
              <button
                key={suit}
                onClick={() => handleSuitChosen(suit)}
                style={{
                  width: "80px",
                  height: "100px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
                }
              >
                <span style={{ fontSize: "36px", color }}>{suit}</span>
                <span
                  style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setPendingWild(null)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* "?" rules modal */}
      {showRules && (
        <div
          onClick={() => setShowRules(false)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 220,
            background: "rgba(5,5,10,0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "480px",
              width: "100%",
              background: "rgba(15,15,26,0.98)",
              border: "1px solid rgba(180,77,255,0.25)",
              borderRadius: "18px",
              padding: "28px 32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "22px",
                  fontWeight: "800",
                  color: "white",
                  margin: 0,
                }}
              >
                Last Card — how to play
              </h2>
              <button
                onClick={() => setShowRules(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "22px",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: '1.6', marginTop: 0 }}>
              Two games are available. <strong>Last Card</strong> is the default; <strong>Blackjack</strong> is the second mode.
            </p>

            <h3 style={rulesSectionStyle}>Last Card — basics</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: '1.6', marginTop: 0 }}>
              Match the top card by suit or rank. First to empty their hand wins. If you can't play, draw one card and your turn ends.
            </p>

            <h3 style={rulesSectionStyle}>Special cards</h3>
            <ul style={rulesListStyle}>
              <li>
                <b>2</b> — next player draws 2 (stackable with other 2s/3s)
              </li>
              <li>
                <b>3</b> — next player draws 3 (stackable)
              </li>
              <li>
                <b>8</b> — reverses direction
              </li>
              <li>
                <b>J</b> — skips the next player
              </li>
              <li>
                <b>A</b> — wild; pick the suit when you play it
              </li>
            </ul>

            <h3 style={rulesSectionStyle}>Last Card rule</h3>
            <ul style={rulesListStyle}>
              <li>
                Call <b>"Last Card!"</b> when you're about to play down to one
                card.
              </li>
              <li>
                Forget? Your opponent can catch you before they take their own
                turn — you draw 2.
              </li>
              <li>You can't win with an Ace as your final card.</li>
            </ul>

            <h3 style={rulesSectionStyle}>Penalties</h3>
            <ul style={rulesListStyle}>
              <li>
                Playing out of turn or an illegal card — your card is rejected.
              </li>
              <li>
                If the draw pile runs out, the discard pile (minus the top card)
                is shuffled back in.
              </li>
            </ul>

            <h3 style={rulesSectionStyle}>Blackjack</h3>
            <ul style={rulesListStyle}>
              <li>Each player starts with <b>500 chips</b>. Both players play against the dealer (not each other).</li>
              <li><b>Bet</b> chips before each round (min 10). Both bets must be in before cards are dealt.</li>
              <li>Both players get 2 face-up cards. Dealer gets 1 face-up, 1 face-down (hole card).</li>
              <li>On your turn: <b>Hit</b> (take a card), <b>Stand</b> (keep score), or <b>Double</b> (double bet, take exactly 1 card, then stand).</li>
              <li>Card values: 2–10 face value · J/Q/K = 10 · Ace = 11 (or 1 if 11 busts).</li>
              <li>Once both players are done, dealer reveals hole card and must hit until 17+.</li>
              <li>Payouts: <b>Blackjack</b> (Ace + 10 on first 2 cards) pays 3:2 · <b>Win</b> pays 1:1 · <b>Push</b> returns the bet · <b>Bust or lose</b> loses the bet.</li>
            </ul>

            <button
              onClick={() => setShowRules(false)}
              style={{
                marginTop: "18px",
                width: "100%",
                padding: "10px",
                borderRadius: "12px",
                background:
                  "linear-gradient(135deg, var(--neon-purple), var(--neon-blue))",
                border: "none",
                color: "white",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* winning / losing screen — only for LastCard (Blackjack has per-round results
          rendered inline rather than a single game-over screen) */}
      {gameMode === 'lastcard' && gameState?.winner && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 250,
          background: 'rgba(5,5,12,0.94)', backdropFilter: 'blur(14px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '20px',
          textAlign: 'center', padding: '40px',
        }}>
          <div style={{ fontSize: '88px' }}>
            {gameState.winner === 'tie' ? '🤝'
              : gameState.winner === socket.id ? '🏆' : '😭'}
          </div>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontSize: '40px',
            fontWeight: '800', color: 'white', margin: 0,
            background: gameState.winner === 'tie'
              ? 'linear-gradient(135deg, #00d4ff, #00ffb3)'
              : gameState.winner === socket.id
                ? 'linear-gradient(135deg, #ffd700, #ff6b35)'
                : 'linear-gradient(135deg, #b44dff, #00d4ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {gameState.winner === 'tie'
              ? "It's a tie!"
              : gameState.winner === socket.id
                ? 'You won!'
                : `${nicknames[gameState.winner] || 'Opponent'} won`}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            {gameState.winner === 'tie'
              ? 'Equal score. Another round?'
              : gameState.winner === socket.id
                ? 'Nicely played. GG.'
                : 'Better luck next round.'}
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              onClick={() => setGameMode("menu")}
              style={{
                padding: "10px 24px",
                borderRadius: "24px",
                background:
                  "linear-gradient(135deg, var(--neon-purple), var(--neon-blue))",
                border: "none",
                color: "white",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Play again
            </button>
            <button
              onClick={() => setGameMode("call")}
              style={{
                padding: "10px 24px",
                borderRadius: "24px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.7)",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Back to call
            </button>
          </div>
        </div>
      )}

      {/* ── AI CHAT PANEL (always available) ── */}
      {chatOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "90px",
            left: "20px",
            width: "320px",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            background: "rgba(15,15,26,0.97)",
            border: "1px solid rgba(180,77,255,0.25)",
            borderRadius: "16px",
            overflow: "hidden",
            maxHeight: "400px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🤖</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--neon-purple)' }}>
              {gameMode === 'blackjack' ? 'Blackjack assistant'
                : gameMode === 'lastcard' ? 'Last Card assistant'
                : 'AceTime assistant'}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                color: "var(--text-muted)",
                background: "rgba(180,77,255,0.1)",
                padding: "2px 8px",
                borderRadius: "10px",
                border: "1px solid rgba(180,77,255,0.2)",
              }}
            >
              Powered by Groq
            </span>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "16px",
                padding: "0 4px",
                marginTop: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minHeight: "160px",
              maxHeight: "260px",
            }}
          >
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "7px 11px",
                    borderRadius:
                      msg.role === "user"
                        ? "12px 12px 2px 12px"
                        : "12px 12px 12px 2px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, var(--neon-purple), var(--neon-blue))"
                        : "rgba(255,255,255,0.06)",
                    border:
                      msg.role === "assistant"
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "none",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    color: "var(--text-primary)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--neon-purple)",
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "8px 10px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "7px 12px",
                color: "var(--text-primary)",
                fontSize: "12px",
                outline: "none",
                fontFamily: "'Inter', sans-serif",
              }}
              placeholder="Ask about the rules..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()}
              disabled={chatLoading}
            />
            <button
              onClick={askAI}
              disabled={chatLoading}
              style={{
                padding: "7px 12px",
                background: chatLoading
                  ? "rgba(180,77,255,0.2)"
                  : "linear-gradient(135deg, var(--neon-purple), var(--neon-blue))",
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "12px",
                cursor: chatLoading ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif",
                marginTop: 0,
                flexShrink: 0,
              }}
            >
              {chatLoading ? "..." : "Ask"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CallScreen;
