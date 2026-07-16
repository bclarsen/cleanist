import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const inventoryRef = collection(db, 'inventory');

function Inventory({ user, workspace }) {
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(inventoryRef, where('workspace', '==', workspace));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setItems(fetched);
    });
    return unsub;
  }, [user, workspace]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      await addDoc(inventoryRef, {
        name: itemName.trim(),
        quantity: Number(quantity) || 1,
        workspace,
        addedBy: user.uid,
        addedByName: user.displayName || user.email,
        createdAt: serverTimestamp(),
      });
      setItemName('');
      setQuantity(1);
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding inventory item:', err);
    }
  };

  const handleUpdateQuantity = async (itemId, currentQty, delta) => {
    const newQty = Math.max(0, currentQty + delta);
    try {
      await updateDoc(doc(db, 'inventory', itemId), {
        quantity: newQty,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating quantity:', err);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const getStatusBadgeClass = (itemStatus) => {
    if (itemStatus === 'In Stock') return 'priority-pill priority-low';
    if (itemStatus === 'Low') return 'priority-pill priority-medium';
    return 'priority-pill priority-high';
  };

  return (
    <div className="inventory-panel" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Cleaning Supplies Inventory</h2>
        <button
          className="btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Supply'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="create-team-form" style={{ marginBottom: '20px', gap: '8px' }}>
          <input
            type="text"
            placeholder="Supply Name (e.g. Paper Towels, Windex)"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '80px' }}
          />
          <button type="submit" className="btn-primary">Add Item</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="empty-note">No cleaning supplies tracked yet. Click "+ Add Supply" to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="task-item"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}
            >
              <div>
                <strong>{item.name}</strong>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    className="btn-ghost"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity || 0, -1)}
                    style={{ padding: '2px 8px', fontWeight: 'bold' }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: '700', minWidth: '24px', textAlign: 'center' }}>
                    {item.quantity ?? 0}
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity || 0, 1)}
                    style={{ padding: '2px 8px', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                </div>

                <button
                  className="btn-delete"
                  title="Delete Item"
                  onClick={() => handleDeleteItem(item.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Inventory;