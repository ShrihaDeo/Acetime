import { useEffect, useState } from 'react'
import Peer from "peerjs"
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

// This is the main call screen component that shows the video feeds and game area
function CallScreen({socket, room , onLeave }) {
  const [syncStatus, setSyncStatus] = useState("Waitiing for moves... ");

  // Listen for moves from the server and update the sync status
  useEffect (() => {
    socket.on('receive-move', (data) => {
      setSyncStatus(`Opponent moved! Count: ${data.count}`);
    });

    return () => socket.off('receive-move');
  }, [socket]);

  const testSync = () => {
    // Send a move to prove sync works in the new UI
    socket.emit('send-move', { room, count: Math.floor(Math.random() * 100) });
  };

  useEffect(() => {
    const peer = new Peer();

    peer.on("open", function (id) {
      console.log("My peer ID is:", id);
      socket.emit("peer-id", id);
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(function (stream) {

        // Show your camera
        const localVideo = document.querySelector("#local-video");
        localVideo.srcObject = stream;
        localVideo.play();

        //answer call
        peer.on("call", function (call) {
          call.answer(stream);
          call.on("stream", function (remoteStream) {
            const remoteVideo = document.querySelector("#remote-video");
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play();
          });
        });

        //code for calling
        socket.on("peer-id", function (otherPeerId) {
          const call = peer.call(otherPeerId, stream);
          call.on("stream", function (remoteStream) {
            const remoteVideo = document.querySelector("#remote-video");
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play();
          });
        });

        })
      .catch(function (err) {
        console.error("Error:", err);
      });

      return () => {
      socket.off("peer-id");
      peer.destroy();
    };

    }, [socket]);

  return (
    <div className="call-screen">
      <div className="left-panel">
        <div className="video-container">
            <div className="main-video">
              <video id="remote-video" autoPlay></video> {/* Opponent here */}
            </div>
            <div className="self-view">
              <video id="local-video" autoPlay muted></video> {/* You here */}
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
          <h3>Room: {room}</h3>
          <p style={{color: 'white'}}>{syncStatus}</p>
          
          <div className="opponent-hand">
            <div className="card-placeholder"></div>
          </div>
          
          <div className="game-table">
            {/* Click this placeholder to test sync */}
            <div className="card-placeholder" onClick={testSync} style={{cursor: 'pointer', border: '2px solid yellow'}}>
               <p style={{fontSize: '10px', color: 'white', textAlign: 'center'}}>Click to Sync</p>
            </div>
          </div>
          
          <div className="player-hand">
            <div className="card-placeholder"></div>
          </div>
        </div>
      </div>
    </div>
  )
}


export default CallScreen