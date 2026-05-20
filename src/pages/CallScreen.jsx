import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'
import Card from '../components/Card' 

const backgrounds = [
  { bg: 'radial-gradient(circle, #1a5c35 0%, #071a10 100%)', suits: ['♠', '♣'], accentColor: '#2ecc71' },
  { bg: 'radial-gradient(circle, #5c1a1a 0%, #1a0707 100%)', suits: ['♥', '♦'], accentColor: '#c0392b' },
  { bg: 'radial-gradient(circle, #0a0a3d 0%, #020210 100%)', suits: ['♣', '♦'], accentColor: '#3498db' },
]

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("System Ready");
  const [bgIndex, setBgIndex] = useState(0);
  const [isOpponentJoined, setIsOpponentJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [gameState, setGameState] = useState(null);
  
  // Keep refs for hardware toggle but use his querySelectors for display
  const myStreamRef = useRef(null);

  // 1. GAME & SYNC LOGIC
  useEffect(() => {
    socket.on('game-init', (serverGameState) => {
      setGameState(serverGameState);
      setIsOpponentJoined(true);
    });

    socket.on('receive-move', (data) => {
      setSyncStatus(`Opponent played: ${data.cardValue} of ${data.cardSuit}`);
    });

    return () => {
      socket.off('game-init');
      socket.off('receive-move');
    };
  }, [socket]);

    useEffect(() => {
    const peer = new Peer();
    let myStream = null;
    let myPeerId = null;
    let pendingPeerId = null; // buffer if peer-id arrives before camera is ready

    const callPeer = (otherPeerId) => {
      if (!myStream) {
        console.log("Stream not ready yet, buffering peer ID");
        pendingPeerId = otherPeerId;
        return;
      }
      console.log("Calling peer:", otherPeerId);
      const call = peer.call(otherPeerId, myStream);
      call.on("stream", (otherStream) => {
        const otherVideo = document.querySelector("video#remote-video");
        if (otherVideo) {
          otherVideo.srcObject = otherStream;
          setIsOpponentJoined(true);
        }
      });
    };

    peer.on("open", (id) => {
      console.log("My peer ID:", id);
      myPeerId = id;
      socket.emit("peer-id", { room, peerId: id });
    });

    socket.on("request-peer-id", () => {
      if (myPeerId) {
        console.log("Re-emitting peer ID:", myPeerId);
        socket.emit("peer-id", { room, peerId: myPeerId });
      }
    });

    socket.on("peer-id", (otherPeerId) => {
      callPeer(otherPeerId);
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStream = stream;
        myStreamRef.current = stream;

        const localVideo = document.querySelector("video#local-video");
        if (localVideo) localVideo.srcObject = stream;

        // If a peer ID arrived before the camera was ready, call them now
        if (pendingPeerId) {
          console.log("Stream now ready, calling buffered peer:", pendingPeerId);
          callPeer(pendingPeerId);
          pendingPeerId = null;
        }

        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (otherStream) => {
            const otherVideo = document.querySelector("video#remote-video");
            if (otherVideo) {
              otherVideo.srcObject = otherStream;
              setIsOpponentJoined(true);
            }
          });
        });
      })
      .catch((err) => console.error("Camera/mic error:", err));

    return () => {
      socket.off("peer-id");
      socket.off("request-peer-id");
      peer.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [socket, room]);

  const cycleBackground = () => setBgIndex((prev) => (prev + 1) % backgrounds.length);

  const toggleMute = () => {
    myStreamRef.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    setIsMuted(prev => !prev);
  };

  const toggleCamera = () => {
    myStreamRef.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setIsCameraOff(prev => !prev);
  };

  const handleCardClick = (card) => {
    setSyncStatus(`You played ${card.value} of ${card.suit}`);
    socket.emit('send-move', { room, cardValue: card.value, cardSuit: card.suit });
  }

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
          <div className="main-video">
            {!isOpponentJoined && <div className="video-placeholder">Waiting for opponent...</div>}
            <video id="remote-video" autoPlay playsInline style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </div>
          <div className="self-view">
            <video id="local-video" autoPlay muted playsInline style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)'}} />
          </div>
        </div>

        <div className="controls-bar">
          <div className="controls-left">
            <button onClick={toggleMute} className="control-btn" style={{backgroundColor: isMuted ? '#ff3b30' : '#3a3a3c'}}><img src={Mute} /></button>
            <button onClick={toggleCamera} className="control-btn" style={{backgroundColor: isCameraOff ? '#ff3b30' : '#3a3a3c'}}><img src={VideoOff} /></button>
          </div>
          <div className="controls-right">
            <button onClick={onLeave} className="control-btn end-call"><img src={EndCall} /></button>
          </div>
        </div>
      </div>

      <div className="right-panel" style={{ 
          background: backgrounds[bgIndex].bg,
          backgroundImage: `radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0), ${backgrounds[bgIndex].bg}`,
          backgroundSize: '30px 30px, 100% 100%'
      }}>
        <div className="table-suits">
          <span className="table-suit" style={{ color: backgrounds[bgIndex].accentColor }}>{backgrounds[bgIndex].suits[0]}</span>
          <span className="table-suit" style={{ color: backgrounds[bgIndex].accentColor }}>{backgrounds[bgIndex].suits[1]}</span>
        </div>
        <div className="table-corners" style={{ color: backgrounds[bgIndex].accentColor }}>
          <span className="corner tl"></span><span className="corner tr"></span>
          <span className="corner bl"></span><span className="corner br"></span>
        </div>
        <div className="game-area">
          <div className="game-header-info">
             <h3 style={{color: 'white', position: 'absolute', top: '20px', left: '30px', margin: '0'}}>Room: {room}</h3>
             <p className="status-text" style={{ color: backgrounds[bgIndex].accentColor, position: 'absolute', top: '45px', left: '30px', margin: '0', fontSize: '12px', fontWeight: 'bold' }}>{syncStatus}</p>
          </div>
          <button onClick={cycleBackground} className="bg-cycle-btn">Change Theme</button>
          <div className="opponent-hand">
            {gameState && Object.keys(gameState.hands).filter(id => id !== socket.id).map(oppId => 
                gameState.hands[oppId].map((_, i) => <div key={i} className="card card-back"></div>)
            )}
          </div>
          <div className="game-table">
            {gameState ? <Card card={gameState.discard[gameState.discard.length - 1]} disabled={true} /> : <div className="card-placeholder">Waiting...</div>}
          </div>
          <div className="player-hand">
            {gameState && gameState.hands[socket.id] ? (
              gameState.hands[socket.id].map((card) => (
                <Card key={card.id} card={card} onClick={() => handleCardClick(card)} />
              ))
            ) : <div style={{color: 'white'}}>Waiting for players...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen;