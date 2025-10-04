import cuid2 from "@paralleldrive/cuid2";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  loginRequests,
  users,
  type LoginRequest,
} from "@peated/server/db/schema";
import { absoluteUrl } from "@peated/server/lib/urls";
import { and, eq, sql } from "drizzle-orm";
import { createHmac, randomBytes } from "node:crypto";

const EXPIRY_SECONDS = 10 * 60; // 10 minutes

function hmacCode(email: string, requestId: string, code: string) {
  const key = config.JWT_SECRET;
  return createHmac("sha256", key)
    .update(`${email}|${requestId}|${code}`)
    .digest("hex");
}

function generate6DigitCode(): string {
  // 6-digit numeric, zero-padded
  const n = randomBytes(4).readUInt32BE() % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function createLoginRequestForUser(
  user: { id: number; email: string },
  opts?: { redirectTo?: string },
) {
  const requestId = cuid2.createId();
  const code = generate6DigitCode();
  const codeHash = hmacCode(user.email.toLowerCase(), requestId, code);
  const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000);

  // Use transaction with FOR UPDATE to lock rows while counting
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(loginRequests)
      .where(
        and(
          eq(loginRequests.userId, user.id),
          sql`${loginRequests.expiresAt} > now()`,
        ),
      )
      .for("update");

    const MAX_ACTIVE_REQUESTS = 5;
    if (rows.length >= MAX_ACTIVE_REQUESTS) {
      throw new Error(
        "Too many active login requests. Please use an existing code or wait for expiry.",
      );
    }

    await tx.insert(loginRequests).values({
      requestId,
      userId: user.id,
      codeHash,
      expiresAt,
    });
  });

  const url = absoluteUrl(
    config.URL_PREFIX,
    `/auth/magic-link?r=${encodeURIComponent(requestId)}&c=${encodeURIComponent(code)}` +
      (opts?.redirectTo
        ? `&redirectTo=${encodeURIComponent(opts.redirectTo)}`
        : ""),
  );

  return { requestId, code, url, expiresAt };
}

export type VerifyResult =
  | { ok: true; request: LoginRequest; userId: number }
  | { ok: false; reason: "not_found" | "expired" | "invalid" };

export async function verifyLoginCode(
  requestId: string,
  code: string,
): Promise<VerifyResult> {
  // Use transaction to keep row lock throughout validation and deletion
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(loginRequests)
      .where(eq(loginRequests.requestId, requestId))
      .for("update");

    if (!row) return { ok: false, reason: "not_found" };
    if (row.expiresAt.getTime() < Date.now())
      return { ok: false, reason: "expired" };

    // Fetch and verify user exists BEFORE consuming the code
    const [userRow] = await tx
      .select({ email: users.email, active: users.active })
      .from(users)
      .where(eq(users.id, row.userId));

    if (!userRow || !userRow.active) {
      return { ok: false, reason: "not_found" };
    }

    const expected = hmacCode(userRow.email.toLowerCase(), requestId, code);
    const valid = timingSafeEqualHex(row.codeHash, expected);

    if (!valid) {
      return { ok: false, reason: "invalid" };
    }

    // Atomically delete the row to consume it - lock is held until transaction commits
    const deleted = await tx
      .delete(loginRequests)
      .where(eq(loginRequests.id, row.id))
      .returning();

    if (deleted.length === 0) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: true, request: deleted[0], userId: row.userId };
  });
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  // constant-time compare
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function rotateLoginRequest(requestId: string): Promise<
  | {
      ok: true;
      requestId: string;
      code: string;
      url: string;
      expiresAt: Date;
      userId: number;
    }
  | { ok: false; reason: "not_found" }
> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(loginRequests)
      .where(eq(loginRequests.requestId, requestId))
      .for("update");

    if (!row) return { ok: false, reason: "not_found" };

    const [{ email }] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, row.userId));

    const code = generate6DigitCode();
    const codeHash = hmacCode(email.toLowerCase(), requestId, code);
    const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000);

    await tx
      .update(loginRequests)
      .set({ codeHash, expiresAt })
      .where(eq(loginRequests.id, row.id));

    const url = absoluteUrl(
      config.URL_PREFIX,
      `/auth/magic-link?r=${encodeURIComponent(requestId)}&c=${encodeURIComponent(code)}`,
    );

    return { ok: true, requestId, code, url, expiresAt, userId: row.userId };
  });
}
