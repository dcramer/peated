import { routerClient } from "@peated/server/orpc/router";
import type { AboutSource } from "@peated/server/schemas/entityAbout";

const sources: AboutSource[] = [
  {
    id: "hes",
    url: "https://portal.historicenvironment.scot/designation/LB578",
    title: "Clynelish Brora Distillery (LB578)",
    publisher: "Historic Environment Scotland",
    publishedOn: null,
    kind: "official",
    status: "available",
  },
  {
    id: "shop",
    url: "https://shop.example.com/brora",
    title: "Brora history",
    publisher: "A shop",
    publishedOn: null,
    kind: "retailer",
    status: "available",
  },
  {
    id: "wp",
    url: "https://en.wikipedia.org/wiki/Brora_distillery",
    title: "Brora distillery",
    publisher: "Wikipedia",
    publishedOn: null,
    kind: "reference",
    status: "available",
  },
];

describe("GET /entities/:entity/about", () => {
  test("returns shown facts, prose, and sources without quotes", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    await fixtures.EntityAbout({
      entityId: entity.id,
      sources,
      events: [
        {
          id: 1,
          kind: "opened",
          date: "1819",
          citations: [
            { sourceId: "hes", statedValue: "1819", quote: "Founded 1819" },
          ],
        },
        {
          id: 2,
          kind: "renamed",
          date: "1969",
          name: "Brora",
          citations: [
            { sourceId: "wp", statedValue: "1968", quote: null },
            { sourceId: "hes", statedValue: "1969", quote: null },
          ],
        },
        // Display rule: a retailer alone cannot support a fact.
        {
          id: 3,
          kind: "closed",
          date: "1983-05",
          citations: [{ sourceId: "shop", statedValue: null, quote: null }],
        },
      ],
      sections: [
        {
          key: "lead",
          heading: null,
          eraEventId: null,
          writtenBy: "pipeline",
          sentences: [
            { text: "It opened in 1819.", factIds: ["event:1"] },
            { text: "It closed in May 1983.", factIds: ["event:3"] },
          ],
        },
      ],
    });

    const about = await routerClient.entities.about.details({
      entity: entity.id,
    });

    expect(about?.events.map(({ id }) => id)).toEqual([1, 2]);
    expect(about?.events[1]?.disagreement).toEqual({
      values: [
        { value: "1968", sourceIds: ["wp"] },
        { value: "1969", sourceIds: ["hes"] },
      ],
    });
    // A sentence that rests on a hidden fact is left out.
    expect(about?.lead?.sentences).toEqual([
      { text: "It opened in 1819.", sourceIds: ["hes"] },
    ]);
    expect(about?.sources.map(({ id }) => id)).toEqual(["hes", "wp"]);
    expect(JSON.stringify(about)).not.toContain("Founded 1819");
  });

  test("returns null for a hidden page", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    await fixtures.EntityAbout({
      entityId: entity.id,
      status: "hidden",
      events: [{ id: 1 }],
    });

    expect(
      await routerClient.entities.about.details({ entity: entity.id }),
    ).toBeNull();
  });

  test("returns null when the entity has no About page", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();

    expect(
      await routerClient.entities.about.details({ entity: entity.id }),
    ).toBeNull();
  });
});
