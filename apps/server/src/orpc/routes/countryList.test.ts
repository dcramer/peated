import { createCaller } from "../router";

test("lists countries", async ({ fixtures }) => {
  await fixtures.Country({ name: "United States" });
  await fixtures.Country({ name: "Japan" });

  const caller = createCaller({ user: null });
  const { results } = await caller.countryList();

  expect(results.length).toBe(2);
});

test("filters countries by search query", async ({ fixtures }) => {
  await fixtures.Country({ name: "United States" });
  await fixtures.Country({ name: "United Kingdom" });
  await fixtures.Country({ name: "Japan" });

  const caller = createCaller({ user: null });
  const { results } = await caller.countryList({ query: "United" });

  expect(results.length).toBe(2);
  expect(results.every((country) => country.name.includes("United"))).toBe(
    true,
  );
});

test("sorts countries by name", async ({ fixtures }) => {
  await fixtures.Country({ name: "Japan" });
  await fixtures.Country({ name: "Canada" });
  await fixtures.Country({ name: "Australia" });

  const caller = createCaller({ user: null });
  const { results } = await caller.countryList();

  expect(results.length).toBe(3);
  expect(results[0].name).toBe("Australia");
  expect(results[1].name).toBe("Canada");
  expect(results[2].name).toBe("Japan");
});
