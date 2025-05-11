import { app } from "@peated/api/app";

describe("GET /regions", () => {
  test("lists regions for a country by id", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Region A",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Region B",
    });

    expect(region1.countryId).toBe(country.id);
    expect(region2.countryId).toBe(country.id);

    const res = await app.request(`/v1/regions?country=${country.id}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(2);
    expect(data.results[0].id).toBe(region1.id);
    expect(data.results[1].id).toBe(region2.id);
    expect(data.rel.nextCursor).toBeNull();
    expect(data.rel.prevCursor).toBeNull();
  });

  test("lists regions for a country by slug", async ({ fixtures }) => {
    const country = await fixtures.Country({ slug: "test-country" });
    const region = await fixtures.Region({ countryId: country.id });

    const res = await app.request(`/v1/regions?country=${country.slug}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
    });

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].id).toBe(region.id);
  });

  test("filters regions by query", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha Region",
    });
    await fixtures.Region({ countryId: country.id, name: "Beta Region" });

    const res = await app.request(
      `/v1/regions?country=${country.id}&query=Alpha`,
      {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      },
    );

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].id).toBe(region1.id);
  });

  test("sorts regions by name ascending", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const res = await app.request(
      `/v1/regions?country=${country.id}&sort=name`,
      {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      },
    );

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(2);
    expect(data.results[0].id).toBe(region1.id);
    expect(data.results[1].id).toBe(region2.id);
  });

  test("sorts regions by name descending", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      name: "Alpha",
    });
    const region2 = await fixtures.Region({
      countryId: country.id,
      name: "Beta",
    });

    const res = await app.request(
      `/v1/regions?country=${country.id}&sort=-name`,
      {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      },
    );

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(2);
    expect(data.results[0].id).toBe(region2.id);
    expect(data.results[1].id).toBe(region1.id);
  });

  test("paginates results", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const regions = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        fixtures.Region({ countryId: country.id, name: `Region ${i + 1}` }),
      ),
    );

    const res = await app.request(
      `/v1/regions?country=${country.id}&limit=2&cursor=1`,
      {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      },
    );

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(2);
    expect(data.results[0].id).toBe(regions[0].id);
    expect(data.results[1].id).toBe(regions[1].id);
    expect(data.rel.nextCursor).toBe(2);
    expect(data.rel.prevCursor).toBeNull();
  });

  test("filters regions with bottles", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const region1 = await fixtures.Region({
      countryId: country.id,
      totalBottles: 1,
    });
    await fixtures.Region({ countryId: country.id, totalBottles: 0 });

    const res = await app.request(
      `/v1/regions?country=${country.id}&hasBottles=1`,
      {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
      },
    );

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.results.length).toBe(1);
    expect(data.results[0].id).toBe(region1.id);
  });

  test("throws error for invalid country slug", async ({ fixtures }) => {
    const res = await app.request(`/v1/regions?country=nonexistent-country`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
    });

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.message).toMatchInlineSnapshot(`"Invalid country."`);
  });
});
