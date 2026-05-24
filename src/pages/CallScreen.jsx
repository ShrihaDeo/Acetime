import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";
import EndCall from "../assets/end_call.svg";
import VideoOff from "../assets/video_off.svg";
import Mute from "../assets/mute.svg";
import Card from "../components/Card";

const backgrounds = [
  {
    bg: "radial-gradient(circle, #1a5c35 0%, #071a10 100%)",
    suits: ["♠", "♣"],
    accentColor: "#2ecc71",
  },
  {
    bg: "radial-gradient(circle, #5c1a1a 0%, #1a0707 100%)",
    suits: ["♥", "♦"],
    accentColor: "#c0392b",
  },
  {
    bg: "radial-gradient(circle, #0a0a3d 0%, #020210 100%)",
    suits: ["♣", "♦"],
    accentColor: "#3498db",
  },
];

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("System Ready");
  const [bgIndex, setBgIndex] = useState(0);
  const [isOpponentJoined, setIsOpponentJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);

  //Stores the entire game state the server sends
  const [gameState, setGameState] = useState(null);

  // Reads the players hand directly from gamestate socked id give you your specific cards '??[]' simply means if this is null or undefined then just use a empty array
  const playerHand = gameState?.hands?.[socket.id] ?? [];
  //gets the opponents card count
  const opponentCount = gameState
    ? (Object.entries(gameState.hands).find(([id]) => id !== socket.id)?.[1] ??
      0)
    : 0;

  //gets the last card in the in the discard array aka the card that is facing up
  const topCard = gameState?.discard?.slice(-1)[0] ?? null;

  useEffect(() => {
    socket.on("receive-move", (data) => {
      setSyncStatus(`Opponent played card ${data.cardID}!`);
    });
    return () => socket.off("receive-move");
  }, [socket]);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      socket.emit("peer-id", { room, peerId: id });
    });

    peer.on("call", (call) => {
      call.answer(myStreamRef.current);
      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current)
          remoteVideoRef.current.srcObject = remoteStream;
        setIsOpponentJoined(true);
      });
    });

    socket.on("peer-id", (otherPeerId) => {
      const call = peer.call(otherPeerId, myStreamRef.current);
      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current)
          remoteVideoRef.current.srcObject = remoteStream;
        setIsOpponentJoined(true);
      });
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      });

    return () => {
      socket.off("peer-id");
      if (peerRef.current) peerRef.current.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [socket, room]);

  // ADDED: The missing function to change backgrounds
  const cycleBackground = () => {
    setBgIndex((prev) => (prev + 1) % backgrounds.length);
  };

  const toggleMute = () => {
    if (!myStreamRef.current) return;
    myStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleCamera = () => {
    if (!myStreamRef.current) return;
    myStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((prev) => !prev);
  };

  //Essentially the same as handle card click, it is seen when a two is placed down the game automatically draws two to the opponents hand 
  const drawCardClick = (card) => {
    setSyncStatus("Drawing +" + card.value + card.suit + "...");
    socket.emit("draw-card", { room, cardID: card.id });
  };

  const handleCardClick = (card) => {
    setSyncStatus("Playing " + card.value + card.suit + "...");
    socket.emit("play-card", { room, cardID: card.id });
  };

  useEffect(() => {
    socket.on("game-started", (state) => {
      setGameState(state);
      setSyncStatus(state.isYourTurn ? "Your turn!" : "Opponent's turn");
    });

    socket.on("game-updated", (state) => {
      setGameState(state);
      setSyncStatus(state.isYourTurn ? "Your turn!" : "Opponent's turn");
    });

    socket.on("game-error", (msg) => {
      setSyncStatus("⚠ " + msg);
    });

    socket.on("opponent-left", () => {
      setSyncStatus("Opponent left the game");
      setGameState(null);
    });

    return () => {
      socket.off("game-started");
      socket.off("game-updated");
      socket.off("game-error");
      socket.off("opponent-left");
    };
  }, [socket]);

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
          <div className="main-video">
            {!isOpponentJoined && (
              <div className="video-placeholder">Waiting for opponent...</div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: isOpponentJoined ? "block" : "none",
              }}
            />
          </div>
          <div className="self-view">
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
          </div>
        </div>
        <div className="controls-bar">
          <button
            onClick={toggleMute}
            className="control-btn"
            style={{ backgroundColor: isMuted ? "#ff3b30" : "#3a3a3c" }}
          >
            <img src={Mute} />
          </button>
          <button
            onClick={toggleCamera}
            className="control-btn"
            style={{ backgroundColor: isCameraOff ? "#ff3b30" : "#3a3a3c" }}
          >
            <img src={VideoOff} />
          </button>
          <button onClick={onLeave} className="control-btn end-call">
            <img src={EndCall} />
          </button>
        </div>
      </div>

      <div
        className="right-panel"
        style={{
          background: backgrounds[bgIndex].bg,
          // ADDED: This creates the felt pattern dots
          backgroundImage: `radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0), ${backgrounds[bgIndex].bg}`,
          backgroundSize: "30px 30px, 100% 100%",
        }}
      >
        {/* Giant suits in the background */}
        <div className="table-suits">
          <span
            className="table-suit"
            style={{ color: backgrounds[bgIndex].accentColor }}
          >
            {backgrounds[bgIndex].suits[0]}
          </span>
          <span
            className="table-suit"
            style={{ color: backgrounds[bgIndex].accentColor }}
          >
            {backgrounds[bgIndex].suits[1]}
          </span>
        </div>

        {/* Decorative Corners */}
        <div
          className="table-corners"
          style={{ color: backgrounds[bgIndex].accentColor }}
        >
          <span className="corner tl"></span>
          <span className="corner tr"></span>
          <span className="corner bl"></span>
          <span className="corner br"></span>
        </div>

        <div className="game-area">
          <div className="game-header-info">
            <h3
              style={{
                color: "white",
                position: "absolute",
                top: "20px",
                left: "30px",
                margin: "0",
              }}
            >
              Room: {room}
            </h3>
            <p
              className="status-text"
              style={{
                color: backgrounds[bgIndex].accentColor,
                position: "absolute",
                top: "45px",
                left: "30px",
                margin: "0",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              {syncStatus}
            </p>
          </div>

          <button onClick={cycleBackground} className="bg-cycle-btn">
            Change Table Theme
          </button>

          <div className="opponent-hand">
            {Array.from({ length: opponentCount }, (_, i) => (
              <div key={i} className="card card-back"></div>
            ))}
            {gameState && (
              <p
                style={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  margin: "6px 0 0 0",
                }}
              >
                Opponent — {opponentCount} cards
              </p>
            )}
          </div>

          <div className="game-table">
            {topCard ? (
              <Card
                card={{ ...topCard, isRed: ["♥", "♦"].includes(topCard.suit) }}
                disabled={true}
              />
            ) : (
              <div
                className="card-placeholder"
                style={{ border: "2px dashed rgba(255,255,255,0.2)" }}
              />
            )}

            <div
              className="card card-back"
              onClick={() => {
                if (!gameState?.isYourTurn) return;
                socket.emit("draw-card", { room });
                setSyncStatus("Drawing a card...");
              }}
              style={{
                cursor: gameState?.isYourTurn ? "pointer" : "not-allowed",
                opacity: gameState?.isYourTurn ? 1 : 0.5,
              }}
            />
          </div>

          <div></div>
          <div className="player-hand">
            {playerHand.map((card) => (
              <Card
                key={card.id}
                card={{ ...card, isRed: ["♥", "♦"].includes(card.suit) }}
                onClick={() => handleCardClick(card)}
                disabled={!gameState?.isYourTurn}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallScreen;
