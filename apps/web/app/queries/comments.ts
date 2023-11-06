import type { CommentSchema } from "@peated/server/schemas";
import type { Paginated } from "@peated/server/types";
import type { z } from "zod";
import type { ApiClient } from "~/lib/api";

export async function fetchComments(
  api: ApiClient,
  tastingId: number | string,
): Promise<Paginated<z.infer<typeof CommentSchema>>> {
  return api.get(`/comments`, { query: { tasting: tastingId } });
}
