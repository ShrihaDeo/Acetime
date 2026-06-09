import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";
import EndCall from "../assets/end_call.svg";
import VideoOff from "../assets/video_off.svg";
import Mute from "../assets/mute.svg";
import Card from "../components/Card";
import { Cat, Fox } from "../components/Pets";
import Avatar from "../components/Avatar";
import EndGameModal from "../components/EndGameModal";
import RulesModal from "../components/RulesModal";
import AICoach from "../components/AICoach";
import CallSettings from "../components/CallSettings";
import { playGameClick } from "../utils/sounds";

import cardPlaySound from "../assets/817551__silverdubloons__pickupcard05.wav";
import winSound from "../assets/274183__littlerobotsoundfactory__jingle_win_synth_04.wav";
import loseSound from "../assets/364929__jofae__game-die.mp3";

import { GAMES, backgrounds } from "../constants/games";

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

  const chatEndRef = useRef(null)
  const [cameraError, setCameraError] = useState(null) 

  const [syncStatus, setSyncStatus] = useState('Waiting for opponent...')
  const [pendingWild, setPendingWild] = useState(null)
  const [lastCardCalled, setLastCardCalled] = useState(false)
  const [callableOpponent, setCallableOpponent] = useState(null) // opponent socket id you can catch
  const [showRules, setShowRules] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)
  const [isOpponentJoined, setIsOpponentJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isOpponentCameraOff, setIsOpponentCameraOff] = useState(false)
  const [gameState, setGameState] = useState(null)
  const [nicknames, setNicknames] = useState({})
  const [copied, setCopied] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [gameMode, setGameMode] = useState('call') // 'call' | 'menu' | 'lastcard'
  const [isHost, setIsHost] = useState(false)
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState("60");
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);

  const playSound = (sound) => 
  {
  new Audio(sound).play().catch(() => {})
  }

  const myStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pendingPeerIdRef = useRef(null)
  const prevHandRef = useRef([])
  // the active PeerJS MediaConnection. we hold onto it so quality changes can
  // call RTCRtpSender.replaceTrack() — otherwise only the local preview updates
  // and the opponent keeps seeing the original encoding.
  const activeCallRef = useRef(null)
  const [showCallSettings, setShowCallSettings] = useState(false)
  

  const myNickname = nicknames[socket.id] || nickname || 'You'
  const opponentNickname = Object.entries(nicknames).find(([id]) => id !== socket.id)?.[1] || 'Opponent'
  const { accent } = backgrounds[bgIndex]



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
      activeCallRef.current = call;
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
          activeCallRef.current = call;
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

  // swap a track on our MediaStream AND on the live peer connection so the
  // opponent actually receives the new encoding. without the replaceTrack call
  // only our own preview would update.
  const swapTrack = async (kind, newTrack) => {
    const stream = myStreamRef.current
    if (!stream) return
    const oldTrack = stream.getTracks().find(t => t.kind === kind)
    if (oldTrack) {
      stream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    stream.addTrack(newTrack)

    const pc = activeCallRef.current?.peerConnection
    if (pc) {
      const sender = pc.getSenders().find(s => s.track?.kind === kind)
      if (sender) await sender.replaceTrack(newTrack)
    }
  }

  const applyCameraSettings = async () => {
    try {
      const [w, h] = resolution === '1080p' ? [1920, 1080] : [1280, 720]
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: w },
          height:    { ideal: h },
          frameRate: { ideal: fps === '60' ? 60 : 30 },
        },
        audio: false,
      })
      const newTrack = newStream.getVideoTracks()[0]
      await swapTrack('video', newTrack)
      if (localVideoRef.current) localVideoRef.current.srcObject = myStreamRef.current
    } catch (err) {
      console.error('camera-settings-failed', err)
    }
  }

  const applyAudioSettings = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { noiseSuppression, echoCancellation },
      })
      const newTrack = newStream.getAudioTracks()[0]
      await swapTrack('audio', newTrack)
    } catch (err) {
      console.error('audio-settings-failed', err)
    }
  }



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

  // styles reused inside the settings dropdown / rules modal
  const settingsItemStyle = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px",
    background: "transparent", border: "none",
    color: "var(--ink)",
    fontSize: 14, fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: '"Fredoka", sans-serif',
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
        <div style={{ position: "absolute", inset: 0, padding: 24, background: "var(--bg-main)" }}>
          {/* opponent video stage */}
          <div style={{
            position: "absolute", top: 24, left: 24, right: 24, bottom: 100,
            background: "var(--bg-blue)",
            border: "var(--border-w) solid var(--ink)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}>
            {!isOpponentJoined ? (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 18,
              }}>
                <div style={{
                  width: 96, height: 96,
                  background: "var(--yellow)",
                  border: "var(--border-w) solid var(--ink)",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: 32, color: "var(--ink)",
                }}>?</div>
                <p className="pixel" style={{ fontSize: 14 }}>WAITING FOR OPPONENT</p>
                <p className="body-sm muted">
                  Share room <span className="pixel" style={{ fontSize: 14, color: "var(--ink)" }}>{room}</span>
                </p>
              </div>
            ) : isOpponentCameraOff ? (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
              }}>
                <Avatar name={opponentNickname} size={100} />
                <p className="body-sm muted">{opponentNickname} turned off camera</p>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>

          {/* my self-view, bottom-right of stage */}
          <div className="cam-tile self" style={{
            position: "absolute", right: 40, bottom: 130,
            width: 200, aspectRatio: "4 / 3",
            zIndex: 10,
          }}>
            {cameraError ? (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: 10, textAlign: "center", gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>🚫</span>
                <span className="body-sm" style={{ color: "var(--red)" }}>{cameraError}</span>
              </div>
            ) : isCameraOff ? (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Avatar name={myNickname} size={44} />
                <span className="body-sm">Camera off</span>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay muted playsInline />
            )}
            <span className="cam-name">{myNickname.toUpperCase()} (you)</span>
          </div>

          {/* room strip — top left */}
          <div className="room-strip" style={{ position: "absolute", top: 40, left: 40, zIndex: 20 }}>
            <span className="label">Room</span>
            <span className="id">{room}</span>
            <button className={`btn btn-md ${copied ? "" : "btn-yellow"}`} onClick={copyRoom}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          {/* controls — bottom centre */}
          <div style={{
            position: "absolute", bottom: 24, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", gap: 12, zIndex: 20,
          }}>
            <button className={`ctrl-btn ${isMuted ? "active" : ""}`} onClick={toggleMute} title="Mute">
              <img src={Mute} alt="" />
            </button>
            <button className={`ctrl-btn ${isCameraOff ? "active" : ""}`} onClick={toggleCamera} title="Camera">
              <img src={VideoOff} alt="" />
            </button>
            <button className={`ctrl-btn ${chatOpen ? "active" : ""}`} onClick={() => setChatOpen(p => !p)} title="Assistant">
              💬
            </button>
            <button
              className={`ctrl-btn ${showCallSettings ? "active" : ""}`}
              onClick={() => setShowCallSettings(s => !s)}
              title="Call quality"
            >
              ⚙
            </button>
            <button className="ctrl-btn end-call" onClick={onLeave} title="End call">
              <img src={EndCall} alt="" />
            </button>
          </div>

          {/* play games */}
          <button
            onClick={() => setGameMode("menu")}
            className="btn btn-red"
            style={{ position: "absolute", top: 40, right: 40, zIndex: 20 }}
          >
            🎮 Play a game
          </button>
        </div>
      )}

      {/* ── MODE: GAME MENU ── */}
      {gameMode === "menu" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 30,
          background: "var(--bg-yellow)",
          overflowY: "auto",
          padding: "56px 48px",
        }}>
          <Fox style={{ top: 56, right: '5%', width: 82, height: 82 }} />

          <div className="container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
              <div>
                <span className="eyebrow orange">choose a game ↓</span>
                <h2 className="h2">What are we playing?</h2>
                <p className="body-md muted" style={{ marginTop: 12 }}>
                  {isOpponentJoined
                    ? "Pick a game — your opponent joins automatically."
                    : "Waiting for opponent before you can start…"}
                </p>
              </div>
              <button className="btn" onClick={() => setGameMode("call")}>← Back to call</button>
            </div>

            <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
              {GAMES.map(game => {
                const selectable = game.available && isOpponentJoined
                const artBg = game.id === "lastcard" ? "var(--bg-blue)"
                            : game.id === "blackjack" ? "var(--bg-green)"
                            : "#e7e3d0"
                const badgeClass = game.id === "lastcard" ? "hot"
                                 : game.id === "blackjack" ? "new"
                                 : "soon"
                const badgeText  = game.id === "lastcard" ? "POPULAR"
                                 : game.id === "blackjack" ? "NEW"
                                 : "SOON"
                return (
                  <div
                    key={game.id}
                    onClick={() => {
                      if (!selectable) return
                      playGameClick()
                      socket.emit("game-selected", { room, game: game.id })
                    }}
                    style={{
                      background: "#fff",
                      border: "var(--border-w) solid var(--ink)",
                      boxShadow: "var(--shadow)",
                      cursor: selectable ? "pointer" : "not-allowed",
                      opacity: game.available ? 1 : 0.55,
                      transition: "transform .15s ease, box-shadow .15s ease",
                      overflow: "hidden",
                      display: "flex", flexDirection: "column",
                    }}
                    onMouseEnter={e => {
                      if (!selectable) return
                      e.currentTarget.style.transform = "translate(-3px, -3px)"
                      e.currentTarget.style.boxShadow = "9px 9px 0 var(--ink)"
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translate(0, 0)"
                      e.currentTarget.style.boxShadow = "var(--shadow)"
                    }}
                  >
                    <div style={{
                      background: artBg,
                      borderBottom: "var(--border-w) solid var(--ink)",
                      padding: 36, textAlign: "center",
                      fontSize: 92, lineHeight: 1,
                    }}>
                      {game.emoji}
                    </div>
                    <div style={{ padding: "18px 22px" }}>
                      <span className={`badge ${badgeClass}`} style={{ marginBottom: 8 }}>{badgeText}</span>
                      <p className="h4" style={{ marginTop: 8 }}>{game.name}</p>
                      <p className="body-sm muted" style={{ marginTop: 2 }}>{game.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* assistant invite — speech bubble */}
            <div style={{
              marginTop: 40,
              background: "#fff",
              border: "var(--border-w) solid var(--ink)",
              boxShadow: "var(--shadow)",
              padding: "24px 28px",
              display: "grid",
              gridTemplateColumns: "72px 1fr auto",
              alignItems: "center",
              gap: 20,
            }}>
              <div style={{
                width: 72, height: 72,
                background: "var(--blue)",
                border: "var(--border-w) solid var(--ink)",
                boxShadow: "var(--shadow-sm)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
              }}>🤖</div>
              <div>
                <h4 className="h4">Stuck on a rule? Ask the table coach.</h4>
                <p className="body-sm muted" style={{ marginTop: 4 }}>
                  It knows your hand, your chips, your turn — and gives advice for your moment.
                </p>
              </div>
              <button className="btn btn-blue" onClick={() => setChatOpen(true)}>Try it</button>
            </div>
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
            background: backgrounds[bgIndex].bg,
            color: "var(--ink)",
            transition: "background 0.5s ease",
          }}
        >
          <span style={{
            position: "absolute", top: 16, left: 24,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 72, color: backgrounds[bgIndex].accent, opacity: 0.18,
            pointerEvents: "none",
          }}>{backgrounds[bgIndex].suits[0]}</span>
          <span style={{
            position: "absolute", bottom: 16, right: 24,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 72, color: backgrounds[bgIndex].accent, opacity: 0.18,
            transform: "rotate(180deg)",
            pointerEvents: "none",
          }}>{backgrounds[bgIndex].suits[1]}</span>

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
              {/* Turn banner — pixel font on chunky ink chip */}
              <div style={{
                position: "absolute", top: 16, left: "50%",
                transform: "translateX(-50%)", zIndex: 2,
                textAlign: "center", pointerEvents: "none",
              }}>
                <span className={`turn-banner ${gameState?.isYourTurn ? "red" : ""}`}>
                  {gameState
                    ? gameState.isYourTurn
                      ? `▶ YOUR TURN, ${myNickname.toUpperCase()}`
                      : `${opponentNickname.toUpperCase()}'S TURN`
                    : syncStatus.toUpperCase()}
                </span>
                {gameState && syncStatus && (
                  <p className="body-sm muted" style={{ marginTop: 6, whiteSpace: "nowrap" }}>
                    {syncStatus}
                  </p>
                )}
              </div>
              <div />
              <div style={{ display: "flex", gap: 8, position: "relative" }}>
                <button className="btn btn-md" onClick={() => setShowRules(true)} title="How to play">
                  ? Rules
                </button>
                <button className="btn btn-md btn-blue" onClick={() => setChatOpen(true)} title="Coach">
                  🤖 Coach
                </button>
                <button
                  className={`btn btn-md ${showSettings ? "btn-yellow" : ""}`}
                  onClick={() => setShowSettings(s => !s)}
                  title="Settings"
                >
                  ⚙
                </button>

                {showSettings && (
                  <div style={{
                    position: "absolute",
                    top: 50, right: 0, zIndex: 60,
                    minWidth: 200,
                    background: "#fff",
                    border: "var(--border-w) solid var(--ink)",
                    boxShadow: "var(--shadow)",
                    padding: 6,
                    display: "flex", flexDirection: "column", gap: 2,
                  }}>
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


                    <button
                      onClick={() => { setShowSettings(false); setShowCallSettings(true) }}
                      style={settingsItemStyle}
                    >
                      📷 <span>Call quality…</span>
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
                      className="btn btn-md btn-red"
                      style={{ marginTop: 12 }}
                    >
                      🃏 LAST CARD!
                    </button>
                  )}

                {/* catch them if they forgot to call last card */}
                {callableOpponent && callableOpponent !== socket.id && (
                  <button
                    onClick={() => socket.emit("call-out-opponent", { room })}
                    className="btn btn-md btn-yellow"
                    style={{ marginTop: 12 }}
                  >
                    ⚠ Catch! they forgot
                  </button>
                )}
                {gameState &&
                  gameState.isYourTurn &&
                  (() => {
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
                    const mustDraw = !hasAnyPlayable;
                    return (
                      <button
                        onClick={handleDraw}
                        className={`btn btn-md ${mustDraw ? "btn-green" : ""}`}
                        style={{ marginTop: 10 }}
                      >
                        {mustDraw ? "⬆ DRAW CARD" : "Draw card"}
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
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--hairline-dark)",
                background: "var(--canvas-dark)",
                position: "relative",
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
              className={`ctrl-btn ${isMuted ? "active" : ""}`}
              onClick={toggleMute}
            >
              <img src={Mute} alt="Mute" />
            </button>
            <button
              className={`ctrl-btn ${isCameraOff ? "active" : ""}`}
              onClick={toggleCamera}
            >
              <img src={VideoOff} alt="Camera" />
            </button>
            <button
              className={`ctrl-btn ${chatOpen ? "active" : ""}`}
              onClick={() => setChatOpen((p) => !p)}
              style={{
                fontSize: "18px",
                backgroundColor: chatOpen ? "rgba(180,77,255,0.3)" : "",
              }}
              title="Game assistant"
            >
              🤖
            </button>
            <button className="ctrl-btn end-call" onClick={onLeave}>
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
            background: 'var(--bg-orange)',
            color: 'var(--ink)',
          }}>
            <span style={{
              position: 'absolute', top: 16, left: 24,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 72, color: 'var(--red-d)', opacity: 0.15,
              pointerEvents: 'none',
            }}>♦</span>
            <span style={{
              position: 'absolute', bottom: 16, right: 24,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 72, color: 'var(--red-d)', opacity: 0.15,
              transform: 'rotate(180deg)',
              pointerEvents: 'none',
            }}>♣</span>

            {/* header */}
            <div style={{
              position: 'absolute', top: 24, left: 32, right: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5,
            }}>
              <span className={`turn-banner ${myStatus === 'playing' ? 'green' : ''}`}>
                {phase === 'betting'    ? 'PLACE YOUR BET'
                 : phase === 'resolved' ? 'ROUND OVER'
                 : myStatus === 'playing' ? '▶ YOUR MOVE'
                 : oppStatus === 'playing' ? `${opponentNickname.toUpperCase()} PLAYING…`
                 : 'DEALER PLAYING…'}
              </span>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <button className="btn btn-md" onClick={() => setShowRules(true)} title="How to play">? Rules</button>
                <button className="btn btn-md btn-blue" onClick={() => setChatOpen(true)} title="Coach">🤖 Coach</button>
                <button
                  className={`btn btn-md ${showSettings ? 'btn-yellow' : ''}`}
                  onClick={() => setShowSettings(s => !s)}
                  title="Settings"
                >⚙</button>
                {showSettings && (
                  <div style={{
                    position: 'absolute', top: 50, right: 0, zIndex: 60,
                    minWidth: 200,
                    background: '#fff',
                    border: 'var(--border-w) solid var(--ink)',
                    boxShadow: 'var(--shadow)',
                    padding: 6,
                    display: 'flex', flexDirection: 'column', gap: 2,
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
                      className="btn btn-red"
                    >
                      ▶ PLACE BET · {betAmount}
                    </button>
                  </div>
                )
              })()}

              {phase === 'betting' && gameState?.bets?.[socket.id] && (
                <p className="body-sm muted" style={{ marginTop: 12 }}>
                  Waiting for {opponentNickname} to bet…
                </p>
              )}

              {/* playing phase — both players act in parallel, dealer settles after */}
              {phase === 'playing' && myStatus === 'playing' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={handleHit} className="btn btn-red">▶ HIT</button>
                  <button onClick={handleStand} className="btn">STAND</button>
                  {canDouble && (
                    <button onClick={handleDouble} className="btn btn-yellow">DOUBLE</button>
                  )}
                </div>
              )}

              {/* round over */}
              {phase === 'resolved' && (
                <button onClick={handleNextRound} className="btn btn-green" style={{ marginTop: 12 }}>
                  ▶ NEXT ROUND
                </button>
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
              <button className={`ctrl-btn compact ${isMuted ? 'active' : ''}`} onClick={toggleMute} title="Mute">
                <img src={Mute} alt="Mute" />
              </button>
              <button className={`ctrl-btn compact ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title="Camera">
                <img src={VideoOff} alt="Camera" />
              </button>
              <button
                className={`ctrl-btn compact ${chatOpen ? 'active' : ''}`}
                onClick={() => setChatOpen(p => !p)}
                style={{ fontSize: '16px', backgroundColor: chatOpen ? 'rgba(180,77,255,0.3)' : '' }}
                title="Game assistant"
              >
                🤖
              </button>
              <button className="ctrl-btn compact end-call" onClick={onLeave} title="Leave">
                <img src={EndCall} alt="End" />
              </button>
            </div>

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
      <RulesModal show={showRules} onClose={() => setShowRules(false)} />

      <CallSettings
        open={showCallSettings}
        onClose={() => setShowCallSettings(false)}
        resolution={resolution} setResolution={setResolution}
        fps={fps} setFps={setFps}
        noiseSuppression={noiseSuppression} setNoiseSuppression={setNoiseSuppression}
        echoCancellation={echoCancellation} setEchoCancellation={setEchoCancellation}
        onApplyCamera={applyCameraSettings}
        onApplyAudio={applyAudioSettings}
      />

      {/* end-of-game modal — Last Card has a single winner, Blackjack ends on resolved phase */}
      <EndGameModal
        show={gameMode === 'lastcard' && !!gameState?.winner}
        kind={
          gameState?.winner === 'tie'        ? 'tie'  :
          gameState?.winner === socket.id    ? 'win'  : 'lose'
        }
        title={
          gameState?.winner === 'tie'     ? "IT'S A TIE!" :
          gameState?.winner === socket.id ? 'YOU WIN!'   :
                                            'GOOD GAME'
        }
        subtitle={
          gameState?.winner === 'tie'     ? 'Equal score. Another round?' :
          gameState?.winner === socket.id ? 'Nicely played. GG.'          :
                                            `${nicknames[gameState?.winner] || 'Opponent'} took this round.`
        }
        onPlayAgain={() => socket.emit('game-selected', { room, game: 'lastcard' })}
        onBack={() => setGameMode('call')}
      />

      {/* same modal for Blackjack — fires once a round resolves */}
      <EndGameModal
        show={gameMode === 'blackjack' && gameState?.phase === 'resolved'}
        kind={
          gameState?.results?.[socket.id] === 'blackjack' ? 'win'  :
          gameState?.results?.[socket.id] === 'win'       ? 'win'  :
          gameState?.results?.[socket.id] === 'push'      ? 'tie'  : 'lose'
        }
        title={
          gameState?.results?.[socket.id] === 'blackjack' ? 'BLACKJACK!' :
          gameState?.results?.[socket.id] === 'win'       ? 'YOU WIN!'   :
          gameState?.results?.[socket.id] === 'push'      ? 'PUSH'       :
          gameState?.results?.[socket.id] === 'bust'      ? 'BUSTED'     :
                                                            'GOOD GAME'
        }
        subtitle={
          gameState?.results?.[socket.id] === 'blackjack' ? `Natural 21 — +${Math.floor((gameState?.bets?.[socket.id] ?? 0) * 1.5)} chips!` :
          gameState?.results?.[socket.id] === 'win'       ? `You took +${gameState?.bets?.[socket.id] ?? 0} chips.` :
          gameState?.results?.[socket.id] === 'push'      ? 'Bet returned.' :
                                                            `Lost ${gameState?.bets?.[socket.id] ?? 0} chips. Try again?`
        }
        onPlayAgain={() => handleNextRound()}
        onBack={() => setGameMode('call')}
      />

      {/* AI coach panel */}
      <AICoach
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        gameMode={gameMode}
        messages={chatMessages}
        loading={chatLoading}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={askAI}
        endRef={chatEndRef}
      />
    </div>
  );
}

export default CallScreen;
