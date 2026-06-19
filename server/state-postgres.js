import "dotenv/config";
import { sql } from "./db.js";

export async function getState() {
  const tasks = await sql`
    SELECT 
    id,title,
    created_date::text as "createdDate",
    retired_date::text as "retiredDate"
    from tasks 
    ORDER BY created_date
  `;
  const rows = await sql`
    SELECT
      date_key::text as date_key,
      task_id,
      done,
      note
    FROM entries
  `;
  const entries = {};
  rows.forEach((row) => {
    entries[row.date_key] ??= {};
    entries[row.date_key][row.task_id] = {
      done: row.done,
      note: row.note,
    };
  });

  return {
    tasks,
    entries,
  };
}
