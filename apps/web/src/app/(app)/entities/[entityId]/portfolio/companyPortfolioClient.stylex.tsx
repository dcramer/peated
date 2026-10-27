"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { FacetGroup } from "@peated/web/components/filterPanel.stylex";
import { EntityCatalogList } from "@peated/web/components/pages/entityCatalog.stylex";
import { buildSearchHref, getCursorHref } from "@peated/web/lib/cursorHref";
import { toEntityCatalogItem } from "@peated/web/lib/entityCatalogItem";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../../styles/tokens.stylex";

import {
  companyPortfolioKinds,
  getCompanyPortfolioInput,
  type CompanyPortfolioKind,
} from "./companyPortfolioParams";

type CompanyPortfolio = Outputs["entities"]["portfolio"];

const sortOptions = [
  { label: "Most bottles", value: "-bottles" },
  { label: "Most reviewed", value: "-tastings" },
  { label: "Name", value: "name" },
] as const;

const kindLabels = {
  brand: "Brands",
  distillery: "Distilleries",
  bottler: "Bottlers",
} as const;

const kindTotals = {
  brand: "brands",
  distillery: "distilleries",
  bottler: "bottlers",
} as const;

export function CompanyPortfolioClient({
  companyId,
  companyName,
  initialPortfolio,
}: {
  companyId: number;
  companyName: string;
  initialPortfolio: CompanyPortfolio;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [displayedParams, setDisplayedParams] = useOptimistic(
    searchParams.toString(),
  );
  const displayedSearchParams = new URLSearchParams(displayedParams);
  const queryInput = getCompanyPortfolioInput(companyId, searchParams);
  const { data: portfolio, isFetching } = useSuspenseQuery({
    ...orpc.entities.portfolio.queryOptions({ input: queryInput }),
    initialData: initialPortfolio,
  });
  const selectedKind = companyPortfolioKinds.find(
    (kind) => kind === displayedSearchParams.get("kind"),
  );
  const page = Number(searchParams.get("cursor") ?? "1") || 1;
  const sort = displayedSearchParams.get("sort") ?? "-bottles";

  function navigate(nextParams: URLSearchParams) {
    startTransition(() => {
      setDisplayedParams(nextParams.toString());
      router.push(buildSearchHref(pathname, nextParams), { scroll: false });
    });
  }

  function updateKind(kind: string) {
    const nextParams = new URLSearchParams(displayedSearchParams);
    if (kind) nextParams.set("kind", kind);
    else nextParams.delete("kind");
    nextParams.delete("cursor");
    navigate(nextParams);
  }

  function updateSort(value: string) {
    const nextParams = new URLSearchParams(displayedSearchParams);
    nextParams.set("sort", value);
    nextParams.delete("cursor");
    navigate(nextParams);
  }

  const noun = selectedKind
    ? kindLabels[selectedKind]
        .toLowerCase()
        .replace(/ies$/, "y")
        .replace(/s$/, "")
    : "result";
  const items = portfolio.results.map((entity) => {
    const ownerPath = entity.ownershipPath
      .slice(1)
      .map(({ name }) => name)
      .join(" › ");

    return {
      ...toEntityCatalogItem(entity),
      ownerPath: ownerPath || undefined,
    };
  });

  return (
    <div {...stylex.props(styles.content)}>
      <EntityCatalogList
        activeFilterCount={selectedKind ? 1 : 0}
        emptyDescription={
          selectedKind
            ? `No recorded ${noun}s are part of ${companyName}.`
            : `${companyName} has no recorded brands, distilleries, or bottlers.`
        }
        emptyHeading={selectedKind ? `No ${noun}s yet` : "No portfolio yet"}
        filters={
          <FacetGroup
            label="Type"
            onChange={updateKind}
            // Leave out types with no records unless they are selected.
            options={companyPortfolioKinds
              .filter(
                (kind) =>
                  kind === selectedKind || portfolio.totals[kindTotals[kind]],
              )
              .map((kind) => ({
                count: portfolio.totals[kindTotals[kind]],
                label: kindLabels[kind],
                value: kind,
              }))}
            selected={selectedKind ?? ""}
            total={portfolio.totals.all}
          />
        }
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          portfolio.rel.nextCursor,
        )}
        noun={noun}
        onClear={() => updateKind("")}
        onSortChange={updateSort}
        page={page}
        pending={isNavigating || isFetching}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          portfolio.rel.prevCursor,
        )}
        sort={sort}
        sortOptions={sortOptions}
        total={portfolio.total}
      />
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x6,
  },
});
