import { useState } from 'react';

// This is the room page component that shows the room ID and a button to join the call.

function RoomPage({ onJoin }) {

    const [room, setRoom] = useState('');
    const [error, setError] = useState('');

    const handleJoin = () => {
        if (room.trim() === '') {
            setError('Please enter a valid room name.');
            return;
        }
        if(!/^\d+$/.test(room)) {
            setError('Room name must be a number.');
            return;
        }
        setError('');
        onJoin(room);
    }
  return (

    <div>
    <div className="suits-bg">
  <span className="suit red">♥</span>
  <span className="suit">♠</span>
  <span className="suit red">♦</span>
  <span className="suit">♣</span>
    </div>
    <div className="room-page">
      <h1>Join or Create a Room</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
        <input

            type="text"
            placeholder="Enter Room ID..."
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{ padding: '12px', borderRadius: '20px', border: '1px solid #ccc', marginRight: '10px' }}
        />
        <button onClick={handleJoin}>Join / Create</button>
    </div>
    </div>
  )
}

export default RoomPage