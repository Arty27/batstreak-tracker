import { sql } from "./db.js";

export async function getEntry(dateKey, taskId) {
  const entry = await sql`
    SELECT note, done
    FROM entries WHERE date_key=${dateKey} and task_id=${taskId}
    `;
  return entry[0] ?? null;
}

export async function upsertEntry(dateKey, taskId, done, note) {
  await sql`
    INSERT INTO entries(date_key, task_id, done, note)
    VALUES (${dateKey},${taskId},${done},${note})
    ON CONFLICT (date_key, task_id)
    DO UPDATE SET
    done=EXCLUDED.done, note=EXCLUDED.note
    `;
}
