import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import SidebarLink from "@peated/web/components/sidebarLink";
import { buildQueryString } from "@peated/web/lib/urls";
import { type MetaFunction, type SerializeFrom } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import { type SitemapFunction } from "remix-sitemap";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

const DEFAULT_SORT = "-tastings";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Bottles",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { trpc } }) => {
    const { searchParams } = new URL(request.url);
    const numericFields = new Set([
      "cursor",
      "limit",
      "age",
      "entity",
      "distiller",
      "bottler",
      "entity",
    ]);
    return json({
      bottleList: await trpc.bottleList.query(
        Object.fromEntries(
          [...searchParams.entries()].map(([k, v]) =>
            numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
          ),
        ),
      ),
    });
  },
);

export default function BottleList() {
  const { bottleList } = useLoaderData<typeof loader>();

  return (
    <Layout rightSidebar={<FilterSidebar />}>
      <QueryBoundary>
        <Content bottleList={bottleList} />
      </QueryBoundary>
    </Layout>
  );
}

function Content({
  bottleList,
}: {
  // TODO: this is probably wrong
  bottleList: SerializeFrom<typeof loader>["bottleList"];
}) {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const sort = qs.get("sort") || DEFAULT_SORT;

  if (!bottleList) return null;

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
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </>
  );
}

function FilterSidebar() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const age = qs.get("age");
  const entity = qs.get("entity");
  const tag = qs.get("tag");

  return (
    <div className="flex-coloverflow-y-auto mt-8 flex bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button to="/addBottle" fullWidth color="highlight">
            Add Bottle
          </Button>
        </li>
        <li>
          <div className="text-sm font-semibold text-slate-200">Category</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("category")}
              to={{
                pathname: location.pathname,
                search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
              to={{
                pathname: location.pathname,
                search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
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
