import { useEffect } from 'react'
import { io } from "socket.io-client";
import Peer from "peerjs";
import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'



function CallScreen({ onLeave }) {
    useEffect(() => {

    var socket = io();  
    var peer = new Peer();

peer.on("open", function (id) {
    console.log("My peer ID is: " + id);
    document.title = "Peer: " + id;
    socket.emit("peer-id", id) //from step 4 emit
});

const constraints = {
    video: true,
    audio: true
};

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        console.log('Got MediaStream:', stream);

        // show your camera
        const videoElement = document.querySelector('video#local-video');
        videoElement.srcObject = stream;

        //answer call
        peer.on("call", function (call) {
            call.answer(stream);   

            call.on("stream", function (otherStream) {
                const otherVideo = document.querySelector('video#remote-video');
                otherVideo.srcObject = otherStream;
                
            });
        });

        //call
        socket.on("peer-id", function (otherPeerId){
        console.log("Calling peer:", otherPeerId);
        var call = peer.call(otherPeerId, stream);

        call.on("stream", function (otherStream) {
        const otherVideo = document.querySelector('video#remote-video');
        otherVideo.srcObject = otherStream;
        });
    })

        

    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

    
    socket.emit("chat message", "hello");
    socket.on("chat message", (msg) => {
        console.log("Received:", msg);
    });

    },[]);
  
  return (
    <div className="call-screen">

      <div className="left-panel">

        <div className = "video-container">
            <div className="main-video">
              <video id="local-video" autoPlay muted></video>
            </div>
            
            <div className="self-view">
              <video id="remote-video" autoPlay></video>
            </div>
        </div>

        <div className="controls-bar">
        <div className="controls-left">
    <button className="control-btn"><img src={Mute} alt="Mute" /></button>
    <button className="control-btn"><img src={VideoOff} alt="Camera" /></button>
  </div>
  <div className="controls-right">
    <button className="control-btn end-call"><img src={EndCall} alt="End Call" /></button>
  </div>
</div>

      </div>

      <div className="right-panel">
          <div className="game-area">
    <div className="opponent-hand">
      <div className="card-placeholder"></div>
      <div className="card-placeholder"></div>
      <div className="card-placeholder"></div>
    </div>
    <div className="game-table">
      <div className="card-placeholder"></div>
    </div>
    <div className="player-hand">
      <div className="card-placeholder"></div>
      <div className="card-placeholder"></div>
      <div className="card-placeholder"></div>
    </div>
  </div>
      </div>

    </div>
  )
}

export default CallScreen