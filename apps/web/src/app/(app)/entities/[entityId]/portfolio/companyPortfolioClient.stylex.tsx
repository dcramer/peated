"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { PageTabs } from "@peated/web/components";
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
  { label: "Most tasted", value: "-tastings" },
  { label: "Name", value: "name" },
] as const;

const kindLabels = {
  brand: "Brands",
  distillery: "Distilleries",
  bottler: "Bottlers",
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

  function getKindHref(kind?: CompanyPortfolioKind) {
    const nextParams = new URLSearchParams(searchParams);
    if (kind) nextParams.set("kind", kind);
    else nextParams.delete("kind");
    nextParams.delete("cursor");
    return buildSearchHref(pathname, nextParams);
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
      <div {...stylex.props(styles.views)}>
        <PageTabs
          ariaLabel={`${companyName} portfolio filters`}
          currentHref={getKindHref(selectedKind)}
          items={[
            {
              count: portfolio.totals.all,
              href: getKindHref(),
              label: "All",
            },
            {
              count: portfolio.totals.brands,
              href: getKindHref("brand"),
              label: "Brands",
            },
            {
              count: portfolio.totals.distilleries,
              href: getKindHref("distillery"),
              label: "Distilleries",
            },
            {
              count: portfolio.totals.bottlers,
              href: getKindHref("bottler"),
              label: "Bottlers",
            },
          ]}
        />
      </div>
      <EntityCatalogList
        emptyDescription={
          selectedKind
            ? `No recorded ${noun}s are part of ${companyName}.`
            : `${companyName} has no recorded brands, distilleries, or bottlers.`
        }
        emptyHeading={selectedKind ? `No ${noun}s yet` : "No portfolio yet"}
        items={items}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          portfolio.rel.nextCursor,
        )}
        noun={noun}
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
  views: {
    marginBottom: space.x6,
  },
});
