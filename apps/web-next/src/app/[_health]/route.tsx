import { type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return new Response("OK");
}
