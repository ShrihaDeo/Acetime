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
// This is the main call screen component that shows the video feeds and game area
function CallScreen({socket, room , onLeave }) {
  const [syncStatus, setSyncStatus] = useState("Waitiing for moves... ");
  const[bgIndex, setbgIndex] = useState(0);
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

  const cycleBackground = () => {
    setbgIndex((prev) => (prev + 1) % backgrounds.length);
  }


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

      <div className="right-panel" style={{background: backgrounds[bgIndex].bg}}>

          <div className="table-suits">
          <span className="table-suit" style={{color: backgrounds[bgIndex].accentColor}}>{backgrounds[bgIndex].suits[0]}</span>
          <span className="table-suit" style={{color: backgrounds[bgIndex].accentColor}}>{backgrounds[bgIndex].suits[1]}</span>
          </div>

          <div className="table-corners">
          <span className="corner tl" style={{borderColor: backgrounds[bgIndex].accentColor}}></span>
          <span className="corner tr" style={{borderColor: backgrounds[bgIndex].accentColor}}></span>
          <span className="corner bl" style={{borderColor: backgrounds[bgIndex].accentColor}}></span>
          <span className="corner br" style={{borderColor: backgrounds[bgIndex].accentColor}}></span>
         </div>
         
        <div className="game-area">

          <h3>Room: {room}</h3>
          <p style={{color: 'white', position: 'absolute', top: '54px', left: '30px', margin: '0', fontSize: '12px'}}>
          {syncStatus}
          </p>
          <button onClick={cycleBackground} className = "bg-cycle-btn"> Change Background </button>
          
          
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