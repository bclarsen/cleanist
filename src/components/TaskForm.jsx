import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const tasksRef = collection(db, 'tasks');

const FREQUENCIES = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// With the team's autoAssign set to 'rotate', new tasks go to whoever currently
// holds the fewest — ties broken by assignee order so the result is deterministic.
function pickRotatedAssignee(allAssignees, tasks) {
  const eligible = allAssignees.filter((a) => !a.isPending);
  if (eligible.length === 0) return '';
  const counts = eligible.map(
      (a) => tasks.filter((t) => t.assignedTo === a.uid).length,
  );
  const fewest = Math.min(...counts);
  return eligible[counts.indexOf(fewest)].uid;
}

function TaskForm({
  user,
  allAssignees = [],
  workspace,
  rooms = ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Other'],
  autoAssign = 'manual',
  tasks = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('Kitchen');
  const [frequency, setFrequency] = useState('weekly');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState(workspace === 'personal' ? user?.uid : '');

  const isRotating = workspace !== 'personal' && autoAssign === 'rotate';
  const rotatedAssignee = isRotating
      ? pickRotatedAssignee(allAssignees, tasks)
      : '';
  const rotatedName = allAssignees.find((a) => a.uid === rotatedAssignee)?.name;

  const addTask = async () => {
    if (!name.trim()) return;

    let resolvedAssignee;
    if (workspace === 'personal') {
      resolvedAssignee = user.uid;
    } else if (isRotating) {
      // Rotation only fills an unset assignee — an explicit pick still wins.
      resolvedAssignee = assignedTo || rotatedAssignee;
    } else {
      resolvedAssignee = assignedTo;
    }

    await addDoc(tasksRef, {
      name: name.trim(),
      room,
      frequency,
      priority,
      dueDate: dueDate || null,
      assignedTo: resolvedAssignee,
      notes: notes.trim(),
      lastCompleted: null,
      completionHistory: [],
      workspace: workspace, // Ensures task is tagged with the current workspace ID
      ownerUid: workspace == 'personal' ? user.uid : null
    });
    setName('');
    setNotes('');
    setDueDate('');
    setAssignedTo('');
    setExpanded(false);
  };

  return (
    <div className="task-form-container">
      {!expanded ? (
        <button className="btn-primary" onClick={() => setExpanded(true)}>
          + Add New Task
        </button>
      ) : (
        <div className="task-form">
          <input
            type="text"
            className="task-name-input"
            placeholder="Task Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="form-row">
            <div className="form-group">
              <label>Room</label>
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            {workspace !== 'personal' && (
              <div className="form-group">
                <label>Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">
                    {isRotating && rotatedName
                      ? `Auto — next up: ${rotatedName}`
                      : 'Unassigned'}
                  </option>
                  {allAssignees.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button className="btn-ghost" onClick={() => setExpanded(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={addTask}
              disabled={!name.trim()}
            >
              Create Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskForm;
