import { getAddAnotherReleasePath } from "@peated/web/lib/bottlings";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bottleId: string }> },
) {
  const { bottleId } = await context.params;

  return new Response(null, {
    status: 308,
    headers: {
      Location: `${getAddAnotherReleasePath(bottleId)}${request.nextUrl.search}`,
    },
  });
}
