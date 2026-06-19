import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");
const dataDir = join(rootDir, "data");
const distDir = join(rootDir, "dist");
const dbPath = join(dataDir, "batstreak.sqlite");
const port = Number(process.env.PORT ?? 4174);

const DEFAULT_TASKS = [
  { id: "system-design", title: "System design", createdDate: "1970-01-01", retiredDate: null },
  { id: "leetcode", title: "LeetCode", createdDate: "1970-01-01", retiredDate: null },
  { id: "interview-prep", title: "Interview prep", createdDate: "1970-01-01", retiredDate: null },
  { id: "job-application", title: "Job application", createdDate: "1970-01-01", retiredDate: null }
];

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_date TEXT NOT NULL,
    retired_date TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    date_key TEXT NOT NULL,
    task_id TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (date_key, task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

const taskColumns = db.prepare("PRAGMA table_info(tasks)").all().map((column) => column.name);
if (!taskColumns.includes("retired_date")) {
  db.exec("ALTER TABLE tasks ADD COLUMN retired_date TEXT");
}

const taskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks").get().count;
if (taskCount === 0) {
  const insertTask = db.prepare("INSERT INTO tasks (id, title, created_date, retired_date) VALUES (?, ?, ?, ?)");
  DEFAULT_TASKS.forEach((task) => insertTask.run(task.id, task.title, task.createdDate, task.retiredDate));
}

const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const todayKey = () => toDateKey(new Date());

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const getState = () => {
  const tasks = db
    .prepare(
      "SELECT id, title, created_date AS createdDate, retired_date AS retiredDate FROM tasks ORDER BY created_date, rowid"
    )
    .all();
  const rows = db.prepare("SELECT date_key, task_id, done, note FROM entries").all();
  const entries = {};

  rows.forEach((row) => {
    entries[row.date_key] ??= {};
    entries[row.date_key][row.task_id] = {
      done: row.done === 1,
      note: row.note
    };
  });

  return { tasks, entries };
};

const createId = (title) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;

const handleApi = async (req, res, url) => {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, getState());
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJson(req);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        sendJson(res, 400, { error: "Task title is required." });
        return true;
      }

      const task = { id: createId(title), title, createdDate: todayKey(), retiredDate: null };
      db.prepare("INSERT INTO tasks (id, title, created_date, retired_date) VALUES (?, ?, ?, ?)").run(
        task.id,
        task.title,
        task.createdDate,
        task.retiredDate
      );
      sendJson(res, 201, task);
      return true;
    }

    const taskDeleteMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (req.method === "DELETE" && taskDeleteMatch) {
      const taskId = decodeURIComponent(taskDeleteMatch[1]);
      const task = db
        .prepare("SELECT created_date AS createdDate, retired_date AS retiredDate FROM tasks WHERE id = ?")
        .get(taskId);
      if (!task) {
        sendJson(res, 404, { error: "Task not found." });
        return true;
      }

      if (task.retiredDate) {
        sendJson(res, 409, { error: "Task is already retired." });
        return true;
      }

      if (task.createdDate === todayKey()) {
        db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
      } else {
        db.prepare("UPDATE tasks SET retired_date = ? WHERE id = ?").run(todayKey(), taskId);
      }

      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === "PATCH" && url.pathname === "/api/entries") {
      const body = await readJson(req);
      const dateKey = typeof body.dateKey === "string" ? body.dateKey : "";
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      const patch = body.patch && typeof body.patch === "object" ? body.patch : {};

      if (dateKey !== todayKey()) {
        sendJson(res, 409, { error: "Only today's tasks can be updated." });
        return true;
      }

      const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
      if (!task) {
        sendJson(res, 404, { error: "Task not found." });
        return true;
      }

      const existing =
        db.prepare("SELECT done, note FROM entries WHERE date_key = ? AND task_id = ?").get(dateKey, taskId) ?? {
          done: 0,
          note: ""
        };

      const next = {
        done: typeof patch.done === "boolean" ? patch.done : existing.done === 1,
        note: typeof patch.note === "string" ? patch.note : existing.note
      };

      if (next.done && next.note.trim().length === 0) {
        next.done = false;
      }

      db.prepare(
        `INSERT INTO entries (date_key, task_id, done, note)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date_key, task_id)
         DO UPDATE SET done = excluded.done, note = excluded.note`
      ).run(dateKey, taskId, next.done ? 1 : 0, next.note);

      sendJson(res, 200, next);
      return true;
    }

    return false;
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
    return true;
  }
};

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};

const serveStatic = async (res, pathname) => {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(distDir, safePath));
  const targetPath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : join(distDir, "index.html");
  const body = await readFile(targetPath);

  res.writeHead(200, {
    "Content-Type": contentTypes[extname(targetPath)] ?? "application/octet-stream"
  });
  res.end(body);
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/") && (await handleApi(req, res, url))) {
    return;
  }

  try {
    await serveStatic(res, url.pathname);
  } catch {
    sendJson(res, 404, { error: "Not found." });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Bat Streak server running at http://127.0.0.1:${port}`);
});
