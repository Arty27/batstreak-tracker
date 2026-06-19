import { validateApiSecret } from "../server/auth.js";
import { createTask } from "../server/task-repository.js";
import { todayKey } from "../server/utils.js";

const createId = (title) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now()}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }
  if (!validateApiSecret(req)) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }
  const title = req.body?.title?.trim();

  if (!title) {
    return res.status(400).json({
      error: "Task Title is required",
    });
  }

  const task = {
    id: createId(title),
    title,
    createdDate: todayKey(),
    retiredDate: null,
  };

  await createTask(task);

  return res.status(201).json(task);
}
