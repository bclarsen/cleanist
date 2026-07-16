import TaskItem from './TaskItem';
import { isOverdue } from '../utils/dateHelpers';

function TaskList({ tasks, currentUser, allAssignees }) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <p>🧹 No tasks here. Add one above!</p>
      </div>
    );
  }

  const grouped = tasks.reduce((acc, task) => {
    const room = task.room || 'Other';
    if (!acc[room]) acc[room] = [];
    acc[room].push(task);
    return acc;
  }, {});

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  Object.keys(grouped).forEach((room) => {
    grouped[room].sort((a, b) => {
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
      );
    });
  });

  return (
    <div className="task-list">
      {Object.entries(grouped).map(([room, roomTasks]) => (
        <section key={room} className="room-group">
          <h2 className="room-heading">
            {room} <span className="room-count">{roomTasks.length}</span>
          </h2>
          <div className="task-items-container">
            {roomTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                currentUser={currentUser}
                allAssignees={allAssignees}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}



export default TaskList;
