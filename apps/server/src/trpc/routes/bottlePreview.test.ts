import { createCaller } from "../router";

test("extracts vintageYear from Delicious Wood (2024)", async ({
  fixtures,
  defaults,
}) => {
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottlePreview({
    name: "Delicious Wood (2024)",
    brand: {
      name: "Old Macallan",
    },
  });

  expect(data.name).toEqual("Delicious Wood");
  expect(data.vintageYear).toEqual(2024);
});

test("extracts vintageYear from Delicious Wood 2024", async ({
  fixtures,
  defaults,
}) => {
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottlePreview({
    name: "Delicious Wood 2024",
    brand: {
      name: "Old Macallan",
    },
  });

  expect(data.name).toEqual("Delicious Wood");
  expect(data.vintageYear).toEqual(2024);
});

test("extracts vintageYear from Delicious Wood 2024 Special", async ({
  fixtures,
  defaults,
}) => {
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottlePreview({
    name: "Delicious Wood 2024 Special",
    brand: {
      name: "Old Macallan",
    },
  });

  expect(data.vintageYear).toEqual(2024);
});
