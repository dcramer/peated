"use client";

import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import SidebarLink from "@peated/web/components/sidebarLink";
import { trpcClient } from "@peated/web/lib/trpc";
import { buildQueryString } from "@peated/web/lib/urls";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const DEFAULT_SORT = "-tastings";

export default function BottleList() {
  const searchParams = useSearchParams();
  const numericFields = new Set([
    "cursor",
    "limit",
    "age",
    "entity",
    "distiller",
    "bottler",
    "entity",
  ]);
  const [bottleList] = trpcClient.bottleList.useSuspenseQuery(
    Object.fromEntries(
      [...searchParams.entries()].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  );

  return (
    <Layout rightSidebar={<FilterSidebar />}>
      <Suspense>
        <Content bottleList={bottleList} />
      </Suspense>
    </Layout>
  );
}

function Content({ bottleList }) {
  const qs = useSearchParams();

  const sort = qs.get("sort") || DEFAULT_SORT;

  return (
    <>
      {bottleList.results.length > 0 ? (
        <BottleTable
          bottleList={bottleList.results}
          rel={bottleList.rel}
          sort={sort}
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </>
  );
}

function FilterSidebar() {
  const qs = useSearchParams();

  const age = qs.get("age");
  const entity = qs.get("entity");
  const tag = qs.get("tag");

  return (
    <div className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button href="/addBottle" fullWidth color="highlight">
            Add Bottle
          </Button>
        </li>
        <li>
          <div className="text-sm font-semibold text-slate-200">Category</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("category")}
              href={{
                // pathname: location.pathname,
                search: buildQueryString(qs, {
                  category: "",
                  cursor: null,
                }),
              }}
              size="small"
            >
              Any Category
            </SidebarLink>
            {CATEGORY_LIST.map((category) => (
              <SidebarLink
                key={category}
                active={qs.get("category") === category}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    category,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {formatCategoryName(category)}
              </SidebarLink>
            ))}
          </ul>
        </li>
        <li>
          <div className="text-sm font-semibold text-slate-200">
            Flavor Profile
          </div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("flavorProfile")}
              href={{
                // pathname: location.pathname,
                search: buildQueryString(qs, {
                  flavorProfile: "",
                  cursor: null,
                }),
              }}
              size="small"
            >
              Any Flavor Profile
            </SidebarLink>
            {FLAVOR_PROFILES.map((flavorProfile) => (
              <SidebarLink
                key={flavorProfile}
                active={qs.get("flavorProfile") === flavorProfile}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    flavorProfile,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {formatFlavorProfile(flavorProfile)}
              </SidebarLink>
            ))}
          </ul>
        </li>
        {entity && (
          <li>
            <div className="text-sm font-semibold text-slate-200">
              Relationship
            </div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <SidebarLink
                active={!qs.get("entity")}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    entity: "",
                    cursor: null,
                  }),
                }}
                size="small"
              >
                Any Relationship
              </SidebarLink>
              <SidebarLink
                active={qs.get("entity") === entity}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    entity,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                TODO: {entity}
              </SidebarLink>
            </ul>
          </li>
        )}
        {age && (
          <li>
            <div className="text-sm font-semibold text-slate-200">Age</div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <SidebarLink
                active={!qs.get("age")}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    age: "",
                    cursor: null,
                  }),
                }}
                size="small"
              >
                Any Age
              </SidebarLink>
              <SidebarLink
                active={qs.get("age") === age}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    age,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {age} years
              </SidebarLink>
            </ul>
          </li>
        )}
        {tag && (
          <li>
            <div className="text-sm font-semibold text-slate-200">Notes</div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <SidebarLink
                active={!qs.get("tag")}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    tag: "",
                    cursor: null,
                  }),
                }}
                size="small"
              >
                Any Notes
              </SidebarLink>
              <SidebarLink
                active={qs.get("tag") === tag}
                href={{
                  // pathname: location.pathname,
                  search: buildQueryString(qs, {
                    tag,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {tag}
              </SidebarLink>
            </ul>
          </li>
        )}
      </ul>
    </div>
  );
}
