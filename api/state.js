import { getState } from "../server/state-postgres.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }
  const state = await getState();
  return res.status(200).json(state);
}
