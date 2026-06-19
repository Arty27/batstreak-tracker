import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getState } from "./state-postgres.js";
import {
  createTask,
  deleteTask,
  retireTask,
  getTask,
} from "./task-repository.js";
import { upsertEntry, getEntry } from "./entry-repository.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");
const dataDir = join(rootDir, "data");
const distDir = join(rootDir, "dist");
const dbPath = join(dataDir, "batstreak.sqlite");
const port = Number(process.env.PORT ?? 4174);

const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const todayKey = () => toDateKey(new Date());

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
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

const createId = (title) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now()}`;

const handleApi = async (req, res, url) => {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      const state = await getState();
      sendJson(res, 200, state);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJson(req);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        sendJson(res, 400, { error: "Task title is required." });
        return true;
      }

      const task = {
        id: createId(title),
        title,
        createdDate: todayKey(),
        retiredDate: null,
      };
      await createTask(task);
      sendJson(res, 201, task);
      return true;
    }

    const taskDeleteMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (req.method === "DELETE" && taskDeleteMatch) {
      const taskId = decodeURIComponent(taskDeleteMatch[1]);
      const task = await getTask(taskId);
      if (!task) {
        sendJson(res, 404, { error: "Task not found." });
        return true;
      }

      if (task.retiredDate) {
        sendJson(res, 409, { error: "Task is already retired." });
        return true;
      }

      if (task.createdDate === todayKey()) {
        await deleteTask(taskId);
      } else {
        await retireTask(taskId, todayKey());
      }

      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === "PATCH" && url.pathname === "/api/entries") {
      const body = await readJson(req);
      const dateKey = typeof body.dateKey === "string" ? body.dateKey : "";
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      const patch =
        body.patch && typeof body.patch === "object" ? body.patch : {};

      if (dateKey !== todayKey()) {
        sendJson(res, 409, { error: "Only today's tasks can be updated." });
        return true;
      }

      const task = await getTask(taskId);
      if (!task) {
        sendJson(res, 404, { error: "Task not found." });
        return true;
      }

      const existing = (await getEntry(dateKey, taskId)) ?? {
        done: false,
        note: "",
      };

      const next = {
        done:
          typeof patch.done === "boolean" ? patch.done : existing.done === 1,
        note: typeof patch.note === "string" ? patch.note : existing.note,
      };

      if (next.done && next.note.trim().length === 0) {
        next.done = false;
      }

      await upsertEntry(dateKey, taskId, next.done, next.note);

      sendJson(res, 200, next);
      return true;
    }

    return false;
  } catch (error) {
    sendJson(res, 500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error.",
    });
    return true;
  }
};

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const serveStatic = async (res, pathname) => {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(distDir, safePath));
  const targetPath =
    filePath.startsWith(distDir) && existsSync(filePath)
      ? filePath
      : join(distDir, "index.html");
  const body = await readFile(targetPath);

  res.writeHead(200, {
    "Content-Type":
      contentTypes[extname(targetPath)] ?? "application/octet-stream",
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
