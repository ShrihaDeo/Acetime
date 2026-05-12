import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("Waiting for moves...");
  
  // Use Refs to store video elements and streams
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const myStreamRef = useRef(null);
  const peerRef = useRef(null);

  // 1. STATE SYNC LOGIC
  useEffect(() => {
    socket.on('receive-move', (data) => {
      setSyncStatus(`Opponent moved! Count: ${data.count}`);
    });
    return () => socket.off('receive-move');
  }, [socket]);

  // 2. VIDEO & P2P LOGIC 
  useEffect(() => {
    // Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My Peer ID is:", id);
      // FIX: Send your ID + the Room Name
      socket.emit("peer-id", { room, peerId: id });
    });

    // Get Camera and Mic
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // --- ANSWERING A CALL ---
        peer.on("call", (call) => {
          call.answer(stream); // Answer with our video
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
        });

        // --- INITIATING A CALL ---
        // This triggers when the OTHER person joins the room
        socket.on("peer-id", (otherPeerId) => {
          console.log("Calling peer:", otherPeerId);
          const call = peer.call(otherPeerId, stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
        });
      })
      .catch((err) => console.error("Media Error:", err));

    // CLEANUP
    return () => {
      socket.off("peer-id");
      if (peerRef.current) peerRef.current.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop()); // Turn off camera light
      }
    };
  }, [socket, room]);

  const testSync = () => {
    socket.emit('send-move', { room, count: Math.floor(Math.random() * 100) });
  };

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
          <div className="main-video">
            {/* Use 'ref' instead of 'id' */}
            <video ref={remoteVideoRef} autoPlay playsInline className="main-video" />
          </div>
          <div className="self-view">
            {/* Use 'ref' instead of 'id' */}
            <video ref={localVideoRef} autoPlay muted playsInline className="self-view-video" />
          </div>
        </div>

        <div className="controls-bar">
          <div className="controls-left">
            <button className="control-btn"><img src={Mute} alt="Mute" /></button>
            <button className="control-btn"><img src={VideoOff} alt="Camera" /></button>
          </div>
          <div className="controls-right">
            <button onClick={onLeave} className="control-btn end-call">
              <img src={EndCall} alt="End Call" />
            </button>
          </div>
        </div>
      </div>

      <div className="right-panel">
        <div className="game-area">
          <h3 style={{color: 'white'}}>Room: {room}</h3>
          <p style={{color: 'white'}}>{syncStatus}</p>
          <div className="game-table">
            <div className="card-placeholder" onClick={testSync} style={{cursor: 'pointer', border: '2px solid yellow'}}>
               <p style={{fontSize: '10px', color: 'white', textAlign: 'center'}}>Test Sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen;