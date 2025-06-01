import { createServerFn } from "@tanstack/react-start";

export const ServerRoute = createServerFileRoute().methods({
  GET: async () => {
    return Response.json({ ok: true });
  },
});
