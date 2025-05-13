import { app } from "../app";
import type { User } from "../db/schema";
import { createAccessToken } from "./auth";

export async function honoRequest({
  path,
  method,
  json,
  user,
}: {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  json?: Record<string, any>;
  user?: User;
}) {
  // this is pretty awful - having to serialize/deserialize both the
  // payload as well as the JWT tokens, but theres no way clean way to inject
  // Context into Hono

  const headers: Record<string, string> = {};
  if (user) {
    headers.Authorization = `Bearer ${await createAccessToken(user)}`;
  }
  if (json) {
    headers["Content-Type"] = "application/json";
  }

  const res = await app.request(path, {
    method,
    body: json ? JSON.stringify(json) : undefined,
    headers,
  });
  const data: any = await res.json();
  return data;
}
