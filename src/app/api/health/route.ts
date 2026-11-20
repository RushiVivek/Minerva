// Liveness check for Render and keep-alive pingers. Deliberately skips the
// database so frequent pings do not keep a scale-to-zero Postgres awake.
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}

export const HEAD = GET;
