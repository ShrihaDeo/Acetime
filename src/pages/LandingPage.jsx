import CardLogo from '../assets/ace_logo.svg'
import { useState } from 'react'


function LandingPage({ onStart }) { // onStart is the function from App.jsx
  const [roomInput, setRoomInput] = useState('');

  const handleJoin = () => {
    if (roomInput.trim() !== '') {
      onStart(roomInput); // Pass the room ID back to App.jsx
    } else {
      alert('Please enter a valid room name.'); 
    }
  }

  return (
    <div className="landing-page">
      <img src={CardLogo} alt="AceTime Logo" style={{width: '150px', marginBottom: '20px'}} />
      <h1>
        <span style={{fontWeight: '400', fontSize: '50px'}}>Welcome to </span>
        <span style={{fontWeight: '700', fontSize: '64px'}}>AceTime</span>
      </h1>
      
      {/* --- ADDED ROOM INPUT --- */}
      <div style={{ margin: '20px 0' }}>
        <input 
          type="text" 
          placeholder="Enter Room Name..." 
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginRight: '10px' }}
        />
        <button onClick={handleJoin}>Start Call</button>
      </div>
      
      <h2>Start a call to connect & play with friends!</h2>
    </div>
  )
}


export default LandingPage