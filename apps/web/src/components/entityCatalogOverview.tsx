"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { Entity } from "@peated/server/types";
import Link from "@peated/web/components/link";
import SimpleRatingIndicator from "@peated/web/components/simpleRatingIndicator";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Catalog = Outputs["entities"]["catalog"];
type RelatedEntity = Catalog["related"]["distillers"][number];

function RankedBars({
  items,
  maxCount,
}: {
  items: { id: string | number; label: string; count: number; href?: string }[];
  maxCount: number;
}) {
  return (
    <ol className="space-y-3">
      {items.slice(0, 5).map((item) => (
        <li key={item.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            {item.href ? (
              <Link href={item.href} className="truncate hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
            <span className="text-muted tabular-nums">
              {item.count.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="bg-highlight h-full rounded-full"
              style={{
                width: `${Math.max((item.count / maxCount) * 100, 2)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function InsightCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {description ? (
          <div className="text-muted mt-1 text-xs">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function selectRelatedEntities(entity: Entity, catalog: Catalog) {
  const views: {
    title: string;
    items: RelatedEntity[];
    coverage?: ReactNode;
  }[] = [];

  const showSourceDistilleries =
    catalog.related.distillers.length > 1 ||
    (catalog.relationships.bottler > 0 &&
      catalog.related.distillers.length > 0);

  if (showSourceDistilleries) {
    const { documented, total } = catalog.distilleryCoverage;
    views.push({
      title: "Source distilleries",
      items: catalog.related.distillers,
      coverage:
        total > 0
          ? `Documented for ${documented.toLocaleString()} of ${total.toLocaleString()} bottles`
          : undefined,
    });
  }
  if (catalog.relationships.distiller > 0 && catalog.related.bottlers.length) {
    views.push({ title: "Bottled by", items: catalog.related.bottlers });
  }
  if (catalog.relationships.distiller > 0 && catalog.related.brands.length) {
    views.push({ title: "Released as", items: catalog.related.brands });
  }

  return views[0] ?? null;
}

export default function EntityCatalogOverview({ entity }: { entity: Entity }) {
  const orpc = useORPC();
  const { data: catalog } = useSuspenseQuery(
    orpc.entities.catalog.queryOptions({ input: { entity: entity.id } }),
  );

  if (!catalog.totalBottles) return null;

  const relationshipStats = [
    { label: "as brand", count: catalog.relationships.brand },
    { label: "bottled", count: catalog.relationships.bottler },
    { label: "distilled", count: catalog.relationships.distiller },
  ].filter((item) => item.count > 0);
  const categoryItems = catalog.categories.map(({ category, count }) => ({
    id: category ?? "uncategorized",
    label: category ? formatCategoryName(category) : "Uncategorized",
    count,
    href: category
      ? `/bottles?entity=${entity.id}&category=${encodeURIComponent(category)}`
      : undefined,
  }));
  const relatedView = selectRelatedEntities(entity, catalog);

  return (
    <section className="my-8" aria-labelledby="catalog-heading">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="catalog-heading" className="text-xl font-semibold">
            Catalog at a glance
          </h2>
          <p className="text-muted mt-1 text-sm">
            {catalog.totalBottles.toLocaleString()} associated bottles
          </p>
        </div>
        <div className="text-muted mt-2 flex flex-wrap gap-2 text-xs sm:mt-0">
          {relationshipStats.map((item) => (
            <span
              key={item.label}
              className="rounded-full bg-slate-900 px-2.5 py-1"
            >
              {item.count.toLocaleString()} {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className={relatedView ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {categoryItems.length ? (
          <InsightCard title="Whisky types">
            <RankedBars
              items={categoryItems}
              maxCount={Math.max(...categoryItems.map((item) => item.count))}
            />
          </InsightCard>
        ) : null}

        {relatedView ? (
          <InsightCard
            title={relatedView.title}
            description={relatedView.coverage}
          >
            <RankedBars
              items={relatedView.items.map((item) => ({
                id: item.id,
                label: item.shortName || item.name,
                count: item.count,
                href: getEntityUrl(item),
              }))}
              maxCount={Math.max(
                ...relatedView.items.map((item) => item.count),
              )}
            />
          </InsightCard>
        ) : null}
      </div>

      {catalog.notableBottles.length ? (
        <section className="mt-6" aria-labelledby="notable-bottles-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h3 id="notable-bottles-heading" className="font-semibold">
              {catalog.notableBottles.some((bottle) => bottle.totalTastings > 0)
                ? "Most tasted bottles"
                : "Catalog bottles"}
            </h3>
            <Link
              href={`${getEntityUrl(entity)}/bottles?sort=-tastings`}
              className="text-highlight text-sm hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.notableBottles.map((bottle) => (
              <article
                key={bottle.id}
                className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-slate-800 px-4 py-3"
              >
                <Link
                  href={`/bottles/${bottle.id}`}
                  className="min-w-0 flex-1 truncate font-semibold hover:underline"
                  title={bottle.fullName}
                >
                  {bottle.fullName}
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <SimpleRatingIndicator avgRating={bottle.avgRating} />
                  {bottle.totalTastings > 0 ? (
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">
                        {bottle.totalTastings.toLocaleString()}
                      </div>
                      <div className="text-muted text-[11px]">tastings</div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
