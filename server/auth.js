import "dotenv/config";
export function validateApiSecret(req) {
  const secret = req.headers["x-api-secret"];
  return secret === process.env.VITE_API_SECRET;
}
