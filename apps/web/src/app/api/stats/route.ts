import { getPublicStats } from "@peated/web/lib/publicStats.server";

export async function GET() {
  // getPublicStats owns the shared cache; this endpoint never reads a session.
  return Response.json(await getPublicStats(), {
    headers: { "Cache-Control": "no-store" },
  });
}
