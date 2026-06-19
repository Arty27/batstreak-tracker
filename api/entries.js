import { validateApiSecret } from "../server/auth.js";
import { getEntry, upsertEntry } from "../server/entry-repository.js";
import { getTask } from "../server/task-repository.js";
import { todayKey } from "../server/utils.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({
      error: "Method Not allowed",
    });
  }
  if (!validateApiSecret(req)) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }
  const body = req?.body;
  const dateKey = body?.dateKey;
  const taskId = body?.taskId;
  const patch = body?.patch ? body.patch : {};

  if (dateKey !== todayKey()) {
    return res.status(400).json({
      error: "Only today's tasks can be updated",
    });
  }

  const task = await getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found!" });
  }

  const existing = (await getEntry(dateKey, taskId)) ?? {
    done: false,
    note: "",
  };

  const next = {
    done: typeof patch.done === "boolean" ? patch.done : existing.done,
    note: typeof patch.note === "string" ? patch.note : existing.note,
  };

  if (next.done && next.note.trim().length === 0) {
    next.done = false;
  }

  await upsertEntry(dateKey, taskId, next.done, next.note);

  return res.status(200).json(next);
}
