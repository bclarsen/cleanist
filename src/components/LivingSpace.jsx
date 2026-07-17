import { useState } from 'react';
import { doc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

function LivingSpace({ rooms, workspace }) {
  const [newRoom, setNewRoom] = useState('');

  const handleAddRoom = async (e) => {
    e.preventDefault();
    const trimmed = newRoom.trim();
    if (!trimmed || rooms.includes(trimmed)) return;

    try {
      const roomRef = doc(db, 'workspaces', workspace);
      // Ensures default rooms aren't lost if the workspace doc was newly created
      const updatedRooms = [...rooms, trimmed];
      await setDoc(roomRef, { rooms: updatedRooms }, { merge: true });
      setNewRoom('');
    } catch (err) {
      console.error('Error adding room:', err);
    }
  };

  const handleDeleteRoom = async (roomToDelete) => {
    if (rooms.length <= 1) return;
    try {
      const roomRef = doc(db, 'workspaces', workspace);
      await setDoc(roomRef, { rooms: arrayRemove(roomToDelete) }, { merge: true });
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  return (
    <div className="living-space-panel" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Rooms</h2>
      </div>

      <form onSubmit={handleAddRoom} className="create-team-form" style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="New room name (e.g. Patio, Balcony)"
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!newRoom.trim()}>
          + Add Room
        </button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {rooms.map((room) => (
          <div
            key={room}
            className="task-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              borderRadius: '8px'
            }}
          >
            <strong>🏠 {room}</strong>
            <button
              className="btn-delete"
              title="Remove room"
              onClick={() => handleDeleteRoom(room)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LivingSpace;