import TaskItem from './TaskItem';
import { isOverdue, isRecentlyCompleted } from '../utils/dateHelpers';


function isTaskDone(task) {
  if (!task.lastCompleted) return false;
  if (task.frequency === 'once') return true;
  return !isOverdue(task);
}



function groupAndSort(taskArr) {
  const grouped = taskArr.reduce((acc, task) => {
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

  return grouped;
}

function TaskList({ tasks, currentUser, allAssignees }) {
  if (tasks.length === 0) {
    return (
        <div className="empty-state">
          <p>🧹 No tasks here. Add one above!</p>
        </div>
    );
  }
  const activeTasks = tasks.filter((t) => !isTaskDone(t));
  const completedTasks = tasks.filter((t) => isTaskDone(t) && isRecentlyCompleted(t));

  return (
      <div className="task-list">
        {activeTasks.length > 0 && (
            <section className="status-section">
              <h2 className="status-heading">Active</h2>
              {Object.entries(groupAndSort(activeTasks)).map(([room, roomTasks]) => (
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
            </section>
        )}

        {completedTasks.length > 0 && (
            <section className="status-section">
              <h2 className="status-heading">Completed</h2>
              {Object.entries(groupAndSort(completedTasks)).map(([room, roomTasks]) => (
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
            </section>
        )}
      </div>
  );
}


export default TaskList;
