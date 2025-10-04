import type { Context } from "hono";

export function getClientIP(c: Context): string | undefined {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    // deno types vs node: Hono Request has raw with remote addr in some envs
    (c.req.raw as any)?.socket?.remoteAddress ||
    undefined
  );
}
