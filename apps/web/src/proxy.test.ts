import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { proxy } from "./proxy";

describe("web proxy", () => {
  test("protects the OAuth authorization response", () => {
    const response = proxy(
      new NextRequest(
        "https://peated.com/oauth/authorize?client_id=peated-cli",
      ),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
