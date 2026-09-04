import {
  mockEntities,
  mockEntityFor,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

function isPortfolioKind(
  kind: (typeof mockEntities)[number]["kind"],
): kind is "brand" | "bottler" | "distillery" {
  return kind === "brand" || kind === "bottler" || kind === "distillery";
}

export default mockOS.entities.portfolio.handler(
  ({ input, context, errors }) => {
    const company = mockEntities.find(({ id }) => id === input.company);
    if (!company) {
      throw errors.NOT_FOUND({ message: "Company not found." });
    }
    if (company.kind !== "company") {
      throw errors.BAD_REQUEST({ message: "Choose a Company." });
    }

    const pathById = new Map<number, number[]>();
    const queue = mockEntities
      .filter(({ ownerId }) => ownerId === company.id)
      .map((entity) => ({ entity, path: [company.id, entity.id] }));

    while (queue.length) {
      const next = queue.shift();
      if (!next || pathById.has(next.entity.id)) continue;
      pathById.set(next.entity.id, next.path);

      for (const child of mockEntities.filter(
        ({ ownerId }) => ownerId === next.entity.id,
      )) {
        if (!next.path.includes(child.id)) {
          queue.push({ entity: child, path: [...next.path, child.id] });
        }
      }
    }

    const portfolioKinds = ["brand", "distillery", "bottler"] as const;
    const allPortfolio = mockEntities.filter(
      (entity) => pathById.has(entity.id) && isPortfolioKind(entity.kind),
    );
    const requestedKinds = input.kinds ?? portfolioKinds;
    const direction = input.sort.startsWith("-") ? -1 : 1;
    const sort = input.sort.replace(/^-/, "");
    const portfolio = allPortfolio
      .filter(
        (entity) =>
          isPortfolioKind(entity.kind) && requestedKinds.includes(entity.kind),
      )
      .toSorted((left, right) => {
        let result = 0;
        switch (sort) {
          case "name":
            result = left.name.localeCompare(right.name);
            break;
          case "tastings":
            result = left.totalTastings - right.totalTastings;
            break;
          case "bottles":
          default:
            result = left.totalBottles - right.totalBottles;
        }
        return direction * result || left.id - right.id;
      });
    const page = mockPage(portfolio, input.cursor, input.limit);
    const signedIn = Boolean(context.user);
    const previews = (kind: (typeof portfolioKinds)[number]) =>
      allPortfolio
        .filter((entity) => entity.kind === kind)
        .toSorted(
          (left, right) =>
            right.totalBottles - left.totalBottles || left.id - right.id,
        )
        .slice(0, 4)
        .map((entity) => mockEntityFor(signedIn, entity));

    return {
      ...page,
      results: page.results.map((entity) => ({
        ...mockEntityFor(signedIn, entity),
        ownershipPath: (pathById.get(entity.id) ?? [])
          .slice(0, -1)
          .flatMap((entityId) => {
            const pathEntity = mockEntities.find(({ id }) => id === entityId);
            return pathEntity
              ? [
                  {
                    id: pathEntity.id,
                    peatedId: pathEntity.peatedId,
                    name: pathEntity.name,
                    kind: pathEntity.kind,
                  },
                ]
              : [];
          }),
      })),
      total: portfolio.length,
      totals: {
        all: allPortfolio.length,
        brands: allPortfolio.filter(({ kind }) => kind === "brand").length,
        distilleries: allPortfolio.filter(({ kind }) => kind === "distillery")
          .length,
        bottlers: allPortfolio.filter(({ kind }) => kind === "bottler").length,
      },
      groupCompanies: {
        results: mockEntities
          .filter(
            ({ kind, ownerId }) => kind === "company" && ownerId === company.id,
          )
          .toSorted(
            (left, right) =>
              right.totalBottles - left.totalBottles || left.id - right.id,
          )
          .slice(0, 4)
          .map((entity) => mockEntityFor(signedIn, entity)),
        total: mockEntities.filter(
          ({ kind, ownerId }) => kind === "company" && ownerId === company.id,
        ).length,
      },
      previews: {
        brands: previews("brand"),
        distilleries: previews("distillery"),
        bottlers: previews("bottler"),
      },
    };
  },
);
