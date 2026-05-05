import EndCall from '../assets/end_call.svg'
import VideoOff from '../assets/video_off.svg'
import Mute from '../assets/mute.svg'

function CallScreen({ onLeave }) {
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