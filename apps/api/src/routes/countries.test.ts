import { app } from "@peated/api/app";
import { describe, expect, test } from "vitest";

describe("GET /countries", () => {
  test("lists countries", async ({ fixtures }: { fixtures: any }) => {
    await fixtures.Country({ name: "United States" });
    await fixtures.Country({ name: "Japan" });

    const res = await app.request("/v1/countries", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.results.length).toBe(2);
    expect(data.results.map((c: any) => c.name).sort()).toEqual(
      ["Japan", "United States"].sort(),
    );
  });

  test("filters countries by search query", async ({
    fixtures,
  }: {
    fixtures: any;
  }) => {
    await fixtures.Country({ name: "United States" });
    await fixtures.Country({ name: "United Kingdom" });
    await fixtures.Country({ name: "Japan" });

    const res = await app.request("/v1/countries?query=United", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.results.length).toBe(2);
    expect(
      data.results.every((country: any) => country.name.includes("United")),
    ).toBe(true);
  });

  test("sorts countries by name", async ({ fixtures }: { fixtures: any }) => {
    await fixtures.Country({ name: "Japan" });
    await fixtures.Country({ name: "Canada" });
    await fixtures.Country({ name: "Australia" });

    const res = await app.request("/v1/countries?sort=name", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.results.length).toBe(3);
    expect(data.results[0].name).toBe("Australia");
    expect(data.results[1].name).toBe("Canada");
    expect(data.results[2].name).toBe("Japan");
  });
});
