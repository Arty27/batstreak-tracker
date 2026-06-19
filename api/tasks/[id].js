import { validateApiSecret } from "../../server/auth.js";
import {
  deleteTask,
  getTask,
  retireTask,
} from "../../server/task-repository.js";
import { todayKey } from "../../server/utils.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }
  if (!validateApiSecret(req)) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const taskId = req.query.id; //how to get the id from the file name?

  const task = await getTask(taskId);

  if (!task) {
    return res.status(404).json({
      error: "Task Not found",
    });
  }

  if (task.retiredDate) {
    return res.status(409).json({
      error: "Task is already retired",
    });
  }

  if (task.createdDate === todayKey()) {
    await deleteTask(taskId);
  } else {
    await retireTask(taskId, todayKey());
  }

  return res.status(200).json({ ok: true });
}
