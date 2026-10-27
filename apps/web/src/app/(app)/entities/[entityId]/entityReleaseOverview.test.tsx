import { mockBottles, mockEntity } from "@peated/server/orpc/mock/fixtures";
import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { Entity } from "./entityPageData";
import { EntityReleaseOverview } from "./entityReleaseOverview";

type BottleList = Outputs["bottles"]["list"];

const emptyList: BottleList = {
  rel: { nextCursor: null, prevCursor: null },
  results: [],
  total: 0,
  followedEntityCount: 0,
};
const bottleList: BottleList = {
  ...emptyList,
  results: mockBottles.slice(0, 2),
  total: 2,
};

function entityOfKind(kind: "brand" | "distillery") {
  return {
    ...mockEntity,
    kind,
    images: [],
    hasAbout: false,
  } satisfies Entity;
}

function render(
  entity: Entity,
  lists: {
    releaseList: BottleList;
    latestBottlings?: BottleList;
  },
) {
  return renderToStaticMarkup(
    <EntityReleaseOverview
      entity={entity}
      error={false}
      pending={false}
      retry={() => undefined}
      {...lists}
    />,
  );
}

describe("EntityReleaseOverview", () => {
  test("shows a distillery's own releases first", () => {
    const html = render(entityOfKind("distillery"), {
      releaseList: bottleList,
      latestBottlings: bottleList,
    });

    expect(html).toContain("Latest distillery releases");
    expect(html).toContain("view=releases");
  });

  test("shows a distillery's latest bottlings when it has no releases of its own", () => {
    const html = render(entityOfKind("distillery"), {
      releaseList: emptyList,
      latestBottlings: bottleList,
    });

    expect(html).toContain("Latest bottlings");
    expect(html).not.toContain("view=releases");
  });

  test("shows a brand's latest releases", () => {
    const html = render(entityOfKind("brand"), { releaseList: bottleList });

    expect(html).toContain("Latest releases");
  });

  test("offers to add a bottle when there are none", () => {
    const html = render(entityOfKind("distillery"), {
      releaseList: emptyList,
      latestBottlings: emptyList,
    });

    expect(html).toContain("No bottles yet");
    expect(html).toContain("Add a bottle");
  });
});
