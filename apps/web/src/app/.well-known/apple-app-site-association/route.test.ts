import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Apple app site association", () => {
  it("allows the iOS app to use passkeys for this domain", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({
      webcredentials: { apps: ["87528L5SLE.com.peated.Peated"] },
    });
  });
});
