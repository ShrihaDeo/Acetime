import CardLogo from '../assets/ace_logo.svg'
import Spade from '../assets/spade.svg'

function LandingPage({ onStart }) {
  return (
    <div>
      <div className="suits-bg">
        <span className="suit red">♥</span>
        <span className="suit">♠</span>
        <span className="suit red">♦</span>
        <span className="suit">♣</span>
      </div>
      <div className="landing-page">
        <img src={CardLogo} alt="AceTime Logo" style={{width: '150px', marginBottom: '20px'}} />
        <h1>
          <span style={{fontWeight: '400', fontSize: '50px'}}>Welcome to </span>
          <img src={Spade} alt="A" style={{width: '90px', verticalAlign: 'middle', marginRight: '-15px', filter: 'invert(1)', marginBottom: '10px'}} />
          <span style={{fontWeight: '700', fontSize: '64px'}}>ceTime</span>
        </h1>
        <button onClick={onStart}>Create or Join a Room</button>
        <h2>Start a call to connect & play with friends!</h2>
      </div>
    </div>
  )
}


export default LandingPage