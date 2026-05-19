import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

const backgrounds = [
  { bg: 'radial-gradient(circle, #1a5c35 0%, #071a10 100%)', suits: ['♠', '♣'], accentColor: '#2ecc71' },
  { bg: 'radial-gradient(circle, #5c1a1a 0%, #1a0707 100%)', suits: ['♥', '♦'], accentColor: '#c0392b' },
  { bg: 'radial-gradient(circle, #0a0a3d 0%, #020210 100%)', suits: ['♣', '♦'], accentColor: '#3498db' },
]

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("System Ready");
  const [bgIndex, setBgIndex] = useState(0);
  const [isOpponentJoined, setIsOpponentJoined] = useState(false);
  
  // Teammate's new states for controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Edward's Professional Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);

  // 1. STATE SYNC LOGIC
  useEffect(() => {
    socket.on('receive-move', (data) => {
      setSyncStatus(`Opponent played card ${data.cardIndex}!`);
    });
    return () => socket.off('receive-move');
  }, [socket]);

  // 2. VIDEO & P2P LOGIC (Fixed for reliability)
  useEffect(() => {
    const peer = new Peer(undefined, {
        config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }] }
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My Peer ID:", id);
      socket.emit("peer-id", { room, peerId: id });
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Answer incoming calls
        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setIsOpponentJoined(true);
          });
        });

        // Handle outgoing calls (Signaling)
        socket.on("peer-id", (otherPeerId) => {
          console.log("Calling peer...");
          const call = peer.call(otherPeerId, stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setIsOpponentJoined(true);
          });
        });
      })
      .catch(err => console.error("Camera Error:", err));

    return () => {
      socket.off("peer-id");
      if (peerRef.current) peerRef.current.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [socket, room]);

  // --- CONTROL FUNCTIONS ---
  
  const cycleBackground = () => setBgIndex((prev) => (prev + 1) % backgrounds.length);

  const toggleMute = () => {
    if (myStreamRef.current) {
        myStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(prev => !prev);
    }
  };

  const toggleCamera = () => {
    if (myStreamRef.current) {
        myStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsCameraOff(prev => !prev);
    }
  };

  const handleCardClick = (i) => {
    setSyncStatus(`You played card ${i + 1}`);
    socket.emit('send-move', { room, cardIndex: i + 1 });
  }

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
          <div className="main-video">
            {!isOpponentJoined && <div className="video-placeholder">Waiting for opponent...</div>}
            <video ref={remoteVideoRef} autoPlay playsInline style={{width: '100%', height: '100%', objectFit: 'cover', display: isOpponentJoined ? 'block' : 'none'}} />
          </div>
          <div className="self-view">
            <video ref={localVideoRef} autoPlay muted playsInline style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)'}} />
          </div>
        </div>

        <div className="controls-bar">
          <div className="controls-left">
            <button onClick={toggleMute} className="control-btn" style={{backgroundColor: isMuted ? '#ff3b30' : '#3a3a3c'}}><img src={Mute} alt="Mute" /></button>
            <button onClick={toggleCamera} className="control-btn" style={{backgroundColor: isCameraOff ? '#ff3b30' : '#3a3a3c'}}><img src={VideoOff} alt="Camera" /></button>
          </div>
          <div className="controls-right">
            <button onClick={onLeave} className="control-btn end-call"><img src={EndCall} alt="End Call" /></button>
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
             <div className="card-placeholder"></div><div className="card-placeholder"></div><div className="card-placeholder"></div>
          </div>
          
          <div className="game-table"><div className="card-placeholder" style={{border: '2px dashed rgba(255,255,255,0.2)'}}></div></div>
          
          <div className="player-hand">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-placeholder" onClick={() => handleCardClick(i)} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: 'rgba(255,255,255,0.1)'}}>
                Card {i+1}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen;