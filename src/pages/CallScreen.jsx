import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

const backgrounds = [
  {
    bg: 'radial-gradient(ellipse at center, #1a5c35 0%, #0d3320 60%, #071a10 100%)',
    suits: ['♠', '♣'],
    accentColor: '#2ecc71'
  },
  {
    bg: 'radial-gradient(ellipse at center, #5c1a1a 0%, #330d0d 60%, #1a0707 100%)',
    suits: ['♥', '♦'],
    accentColor: '#c0392b'
  },
  {
    bg: 'radial-gradient(ellipse at center, #0a0a3d 0%, #05051f 60%, #020210 100%)',
    suits: ['♠', '♦'],
    accentColor: '#3498db'
  },
]

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("Waiting for moves...");
  const [bgIndex, setBgIndex] = useState(0);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const myStreamRef = useRef(null);
  const peerRef = useRef(null);

  // --- SYNC LOGIC ---
  useEffect(() => {
    console.log("Sync listener started for room:", room);

    socket.on('receive-move', (data) => {
      console.log("Sync received from opponent:", data);
      setSyncStatus(`Opponent played card ${data.cardIndex}!`);
    });

    return () => socket.off('receive-move');
  }, [socket, room]);

  // --- VIDEO LOGIC (Centered with object-fit) ---
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      socket.emit("peer-id", { room, peerId: id });
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          });
        });

        socket.on("peer-id", (otherPeerId) => {
          const call = peer.call(otherPeerId, stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          });
        });
      })
      .catch(err => console.error("Camera Error:", err));

    return () => {
      socket.off("peer-id");
      if (peerRef.current) peerRef.current.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, room]);

  const handleCardClick = (i) => {
    const cardData = { room, cardIndex: i + 1 };
    console.log("Sending move to server:", cardData);
    setSyncStatus(`You played card ${i + 1}`);
    socket.emit('send-move', cardData);
  }

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
          <div className="main-video">
            {/* Added objectFit: 'cover' to center the camera */}
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          <div className="self-view">
             {/* Added objectFit: 'cover' and transform scaleX(-1) to mirror your own face */}
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
            />
          </div>
        </div>

        <div className="controls-bar">
          <button className="control-btn"><img src={Mute} alt="Mute" /></button>
          <button className="control-btn"><img src={VideoOff} alt="Camera" /></button>
          <button onClick={onLeave} className="control-btn end-call"><img src={EndCall} alt="End Call" /></button>
        </div>
      </div>

      <div className="right-panel" style={{background: backgrounds[bgIndex].bg}}>
        <div className="game-area">
          <h3 style={{color: 'white', margin: '0'}}>Room: {room}</h3>
          <p style={{color: backgrounds[bgIndex].accentColor, fontSize: '14px', fontWeight: 'bold'}}>{syncStatus}</p>
          
          <button onClick={() => setBgIndex((prev) => (prev + 1) % backgrounds.length)} className="bg-cycle-btn">
             Change Color
          </button>

          <div className="opponent-hand">
            <div className="card-placeholder"></div>
            <div className="card-placeholder"></div>
            <div className="card-placeholder"></div>
          </div>

          <div className="game-table">
            <div className="card-placeholder" style={{ border: '2px dashed white' }}></div>
          </div>

          <div className="player-hand">
            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className="card-placeholder" 
                onClick={() => handleCardClick(i)} 
                style={{cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3a3a3c'}}
              >
                <span style={{color: 'white'}}>Card {i+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen;