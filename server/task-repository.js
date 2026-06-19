import { sql } from "./db.js";

export async function createTask(task) {
  await sql`
  INSERT INTO tasks(id,title,created_date,retired_date) 
  VALUES(${task.id},${task.title},${task.createdDate},${task.retiredDate})
  `;
}

export async function getTask(taskId) {
  const rows = await sql`
    SELECT
      id,
      created_date::text AS "createdDate",
      retired_date::text AS "retiredDate"
    FROM tasks
    WHERE id = ${taskId}`;

  return rows[0] ?? null;
}

export async function deleteTask(taskId) {
  await sql`
    DELETE FROM tasks WHERE id=${taskId}
    `;
}

export async function retireTask(taskId, retiredDate) {
  await sql`
    UPDATE tasks
    SET retired_date = ${retiredDate}
    WHERE id = ${taskId}
  `;
}
