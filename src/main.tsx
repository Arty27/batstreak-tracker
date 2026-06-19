import React from "react";
import ReactDOM from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Moon,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import BatLogo from "../public/assets/bat_logo.png";
import "./styles.css";

type TaskDefinition = {
  id: string;
  title: string;
  createdDate: string;
  retiredDate?: string | null;
};

type TaskEntry = {
  done: boolean;
  note: string;
};

type DailyEntry = Record<string, TaskEntry>;

type AppState = {
  tasks: TaskDefinition[];
  entries: Record<string, DailyEntry>;
};

const STORAGE_KEY = "bat-streak-state-v1";
const DEFAULT_TASKS: TaskDefinition[] = [
  {
    id: "system-design",
    title: "System design",
    createdDate: "1970-01-01",
    retiredDate: null,
  },
  {
    id: "leetcode",
    title: "LeetCode",
    createdDate: "1970-01-01",
    retiredDate: null,
  },
  {
    id: "interview-prep",
    title: "Interview prep",
    createdDate: "1970-01-01",
    retiredDate: null,
  },
  {
    id: "job-application",
    title: "Job application",
    createdDate: "1970-01-01",
    retiredDate: null,
  },
];

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const shiftDate = (dateKey: string, amount: number) => {
  const next = fromDateKey(dateKey);
  next.setDate(next.getDate() + amount);
  return toDateKey(next);
};

const formatDate = (dateKey: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(fromDateKey(dateKey));

const createId = (title: string) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now()}`;

const createEmptyEntry = (): TaskEntry => ({ done: false, note: "" });

const getTaskEntry = (state: AppState, dateKey: string, taskId: string) =>
  state.entries[dateKey]?.[taskId] ?? createEmptyEntry();

const getTasksForDate = (state: AppState, dateKey: string) =>
  state.tasks.filter(
    (task) =>
      task.createdDate <= dateKey &&
      (!task.retiredDate || dateKey < task.retiredDate),
  );

const isTaskComplete = (entry: TaskEntry) =>
  entry.done && entry.note.trim().length > 0;

const isDayComplete = (state: AppState, dateKey: string) => {
  const tasks = getTasksForDate(state, dateKey);
  return (
    tasks.length > 0 &&
    tasks.every((task) => isTaskComplete(getTaskEntry(state, dateKey, task.id)))
  );
};

const getStoredState = (): AppState => {
  const fallback: AppState = { tasks: DEFAULT_TASKS, entries: {} };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as AppState;
    if (!Array.isArray(parsed.tasks) || typeof parsed.entries !== "object")
      return fallback;
    return {
      tasks: parsed.tasks.map((task) => ({
        ...task,
        createdDate: task.createdDate ?? "1970-01-01",
        retiredDate: task.retiredDate ?? null,
      })),
      entries: parsed.entries,
    };
  } catch {
    return fallback;
  }
};

const getCurrentStreak = (state: AppState, todayKey: string) => {
  let count = 0;
  let cursor = todayKey;

  while (isDayComplete(state, cursor)) {
    count += 1;
    cursor = shiftDate(cursor, -1);
  }

  return count;
};

const getBestStreak = (state: AppState) => {
  const completeDays = Object.keys(state.entries)
    .filter((dateKey) => isDayComplete(state, dateKey))
    .sort();

  let best = 0;
  let current = 0;
  let previous = "";

  completeDays.forEach((dateKey) => {
    current = previous && shiftDate(previous, 1) === dateKey ? current + 1 : 1;
    best = Math.max(best, current);
    previous = dateKey;
  });

  return best;
};

const getCompletionRate = (state: AppState, dateKey: string) => {
  const tasks = getTasksForDate(state, dateKey);
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) =>
    isTaskComplete(getTaskEntry(state, dateKey, task.id)),
  ).length;
  return Math.round((completed / tasks.length) * 100);
};

const App = () => {
  const todayKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = React.useState(todayKey);
  const [state, setState] = React.useState<AppState>(getStoredState);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [syncError, setSyncError] = React.useState("");

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  React.useEffect(() => {
    fetch("/api/state")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load database state.");
        return response.json() as Promise<AppState>;
      })
      .then((databaseState) => {
        setState({
          tasks: databaseState.tasks.map((task) => ({
            ...task,
            createdDate: task.createdDate ?? "1970-01-01",
            retiredDate: task.retiredDate ?? null,
          })),
          entries: databaseState.entries ?? {},
        });
        setSyncError("");
      })
      .catch(() => {
        setSyncError(
          "Database offline. Changes are saved in this browser until the API is running.",
        );
      });
  }, []);

  const currentStreak = getCurrentStreak(state, todayKey);
  const bestStreak = getBestStreak(state);
  const completionRate = getCompletionRate(state, selectedDate);
  const selectedComplete = isDayComplete(state, selectedDate);
  const selectedTasks = getTasksForDate(state, selectedDate);
  const canEditSelectedDate = selectedDate === todayKey;

  const requestJson = async <T,>(
    url: string,
    options?: RequestInit,
  ): Promise<T> => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Database request failed.");
    }

    return payload as T;
  };

  const updateTaskEntry = (taskId: string, patch: Partial<TaskEntry>) => {
    if (!canEditSelectedDate) return;

    setState((previous) => {
      const day = previous.entries[selectedDate] ?? {};
      const existing = day[taskId] ?? createEmptyEntry();
      const updated = { ...existing, ...patch };

      if (patch.done && updated.note.trim().length === 0) {
        updated.done = false;
      }

      return {
        ...previous,
        entries: {
          ...previous.entries,
          [selectedDate]: {
            ...day,
            [taskId]: updated,
          },
        },
      };
    });

    requestJson<TaskEntry>("/api/entries", {
      method: "PATCH",
      body: JSON.stringify({ dateKey: selectedDate, taskId, patch }),
    })
      .then(() => setSyncError(""))
      .catch((error: Error) => setSyncError(error.message));
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title || !canEditSelectedDate) return;

    const optimisticTask = {
      id: createId(title),
      title,
      createdDate: todayKey,
      retiredDate: null,
    };
    setState((previous) => ({
      ...previous,
      tasks: [...previous.tasks, optimisticTask],
    }));
    setNewTaskTitle("");

    requestJson<TaskDefinition>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title }),
    })
      .then((task) => {
        setState((previous) => ({
          ...previous,
          tasks: previous.tasks.map((existing) =>
            existing.id === optimisticTask.id ? task : existing,
          ),
        }));
        setSyncError("");
      })
      .catch((error: Error) => setSyncError(error.message));
  };

  const removeTask = (taskId: string) => {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (!canEditSelectedDate || !task) return;

    setState((previous) => {
      const tasks =
        task.createdDate === todayKey
          ? previous.tasks.filter((candidate) => candidate.id !== taskId)
          : previous.tasks.map((candidate) =>
              candidate.id === taskId
                ? { ...candidate, retiredDate: todayKey }
                : candidate,
            );

      return { ...previous, tasks };
    });

    requestJson<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    })
      .then(() => setSyncError(""))
      .catch((error: Error) => setSyncError(error.message));
  };

  const lastSevenDays = Array.from({ length: 7 }, (_, index) =>
    shiftDate(todayKey, index - 6),
  );

  return (
    <main className="app-shell">
      <div className="signal-beam" />
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">
            <Moon size={16} />
            Gotham discipline tracker
          </div>
          <h1>Bat Streak</h1>
          <p>
            Every mission needs evidence. Finish every active task and add a
            note to lock the day into your streak.
          </p>
        </div>
        <div
          className="bat-placeholder"
          aria-label="Placeholder for your Batman image or logo"
        >
          <img src={BatLogo} width="300" alt="BatLogo" />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="streak-panel">
          <div
            className="stat-ring"
            style={
              { "--progress": `${completionRate}%` } as React.CSSProperties
            }
          >
            <span>{completionRate}%</span>
          </div>
          <div>
            <p className="panel-label">Current streak</p>
            <strong>{currentStreak}</strong>
            <span className="unit">days</span>
          </div>
          <div>
            <p className="panel-label">Best streak</p>
            <strong>{bestStreak}</strong>
            <span className="unit">days</span>
          </div>
        </div>

        <div className="week-strip" aria-label="Last seven days">
          {lastSevenDays.map((dateKey) => (
            <button
              className={`day-chip ${dateKey === selectedDate ? "active" : ""} ${isDayComplete(state, dateKey) ? "complete" : ""}`}
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              type="button"
            >
              {isDayComplete(state, dateKey) ? (
                <span className="bat-day-mark" aria-hidden="true">
                  <img src={BatLogo} width="20" />
                </span>
              ) : null}
              <span>
                {new Intl.DateTimeFormat("en", { weekday: "short" }).format(
                  fromDateKey(dateKey),
                )}
              </span>
              <strong>{fromDateKey(dateKey).getDate()}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="mission-header">
        <div>
          <p className="panel-label">
            <CalendarDays size={15} />
            Active mission day
          </p>
          <h2>{formatDate(selectedDate)}</h2>
        </div>
        <div className="date-controls">
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => setSelectedDate(todayKey)}>
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      <section className="task-grid">
        {selectedTasks.map((task, index) => {
          const entry = getTaskEntry(state, selectedDate, task.id);
          const noteReady = entry.note.trim().length > 0;
          const complete = isTaskComplete(entry);
          const canRemoveTask = canEditSelectedDate;

          return (
            <article
              className={`task-card ${complete ? "complete" : ""}`}
              key={task.id}
            >
              <div className="task-topline">
                <span className="task-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => removeTask(task.id)}
                  disabled={!canRemoveTask}
                  aria-label={`Remove ${task.title}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <h3>{task.title}</h3>
              <textarea
                placeholder={`Evidence for ${task.title.toLowerCase()}...`}
                value={entry.note}
                disabled={!canEditSelectedDate}
                onChange={(event) =>
                  updateTaskEntry(task.id, {
                    note: event.target.value,
                    done: false,
                  })
                }
              />
              <button
                className="complete-button"
                disabled={!noteReady || !canEditSelectedDate}
                type="button"
                onClick={() => updateTaskEntry(task.id, { done: !entry.done })}
              >
                {complete ? <Check size={18} /> : <Flame size={18} />}
                {!canEditSelectedDate
                  ? "Today only"
                  : complete
                    ? "Locked in"
                    : noteReady
                      ? "Mark complete"
                      : "Add note first"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="task-manager">
        <div>
          <p className="panel-label">Adjust mission loadout</p>
          <h2>Add another task</h2>
        </div>
        <div className="add-task-row">
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
            }}
            disabled={!canEditSelectedDate}
            placeholder="Portfolio outreach, mock interview, resume polish..."
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!newTaskTitle.trim() || !canEditSelectedDate}
          >
            <Plus size={18} />
            {canEditSelectedDate ? "Add task" : "Today only"}
          </button>
        </div>
      </section>

      <div className={`sync-toast ${syncError ? "visible" : ""}`}>
        {syncError}
      </div>

      <div className={`streak-toast ${selectedComplete ? "visible" : ""}`}>
        <Check size={18} />
        Streak day secured
      </div>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
