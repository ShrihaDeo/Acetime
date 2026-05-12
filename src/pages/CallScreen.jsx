import { useEffect, useState, useRef } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

function CallScreen({ socket, room, onLeave }) {
  const [syncStatus, setSyncStatus] = useState("Waiting for moves...");
  
  // Ref-based approach for video
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

  // 2. WEBRTC & VIDEO LOGIC
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My Peer ID:", id);
      // FIXED: Send Peer ID + Room so only people in the same room call you
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
          });
        });

        // Initiate outgoing calls (Signaled via Socket.io)
        socket.on("peer-id", (otherPeerId) => {
          console.log("Calling peer in room:", room);
          const call = peer.call(otherPeerId, stream);
          call.on("stream", (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          });
        });
      })
      .catch(err => console.error("Camera Error:", err));

    // Cleanup when leaving
    return () => {
      socket.off("peer-id");
      if (peerRef.current) peerRef.current.destroy();
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
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
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="self-view">
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
        <div className="controls-bar">
          <button className="control-btn"><img src={Mute} alt="Mute" /></button>
          <button className="control-btn"><img src={VideoOff} alt="Camera" /></button>
          <button onClick={onLeave} className="control-btn end-call"><img src={EndCall} alt="End Call" /></button>
        </div>
      </div>
      <div className="right-panel">
        <div className="game-area">
          <h3 style={{color: 'white'}}>Room: {room}</h3>
          <p style={{color: 'white'}}>{syncStatus}</p>
          <div className="game-table">
            <div className="card-placeholder" onClick={testSync} style={{cursor: 'pointer', border: '2px solid yellow'}}>
               <p style={{fontSize: '10px', color: 'white', textAlign: 'center'}}>Click to Sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallScreen;