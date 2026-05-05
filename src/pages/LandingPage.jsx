import CardLogo from '../assets/ace_logo.svg'
function LandingPage({ onStart }) {
  return (
    <div>
        <img src={CardLogo} alt="AceTime Logo" style={{width: '150px', marginBottom: '20px'}} />
      <h1>
        <span style={{fontWeight: '400', fontSize: '50px'}}>Welcome to </span>
        <span style={{fontWeight: '700', fontSize: '64px'}}>AceTime</span>
      </h1>
      <button onClick={onStart}>Start Call</button>
      <h2>Start a call to connect & play with friends!</h2>

    </div>
  )
}

export default LandingPage