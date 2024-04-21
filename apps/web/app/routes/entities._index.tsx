import { ENTITY_TYPE_LIST, MAJOR_COUNTRIES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import SidebarLink from "@peated/web/components/sidebarLink";
import { buildQueryString } from "@peated/web/lib/urls";
import { type MetaFunction, type SerializeFrom } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import { type SitemapFunction } from "remix-sitemap";
import Button from "../components/button";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

const DEFAULT_SORT = "-tastings";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Brands, Bottler, and Distillers",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { trpc } }) => {
    const { searchParams } = new URL(request.url);
    const numericFields = new Set(["cursor", "limit"]);
    return json({
      entityList: await trpc.entityList.query(
        Object.fromEntries(
          [...searchParams.entries()].map(([k, v]) =>
            numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
          ),
        ),
      ),
    });
  },
);

export default function Entities() {
  const { entityList } = useLoaderData<typeof loader>();
  return (
    <Layout rightSidebar={<FilterSidebar />}>
      <QueryBoundary>
        <Content entityList={entityList} />
      </QueryBoundary>
    </Layout>
  );
}

function Content({
  entityList,
}: {
  // TODO: this is probably wrong
  entityList: SerializeFrom<typeof loader>["entityList"];
}) {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const sort = qs.get("sort") || DEFAULT_SORT;

  if (!entityList) return null;

  return (
    <>
      {entityList.results.length > 0 ? (
        <EntityTable
          entityList={entityList.results}
          rel={entityList.rel}
          sort={sort}
          withTastings
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

  const country = qs.get("country");
  const region = qs.get("region");

  return (
    <div className="flex-coloverflow-y-auto mt-8 flex bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-auto flex-col gap-y-7">
        <li>
          <Button to="/addEntity" fullWidth color="highlight">
            Add Entity
          </Button>
        </li>

        <li>
          <div className="text-sm font-semibold text-slate-200">Type</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("type")}
              to={{
                pathname: location.pathname,
                search: buildQueryString(location.search, {
                  type: "",
                  cursor: null,
                }),
              }}
              size="small"
            >
              Any Type
            </SidebarLink>
            {ENTITY_TYPE_LIST.map((type) => (
              <SidebarLink
                key={type}
                active={qs.get("type") === type}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    type,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {toTitleCase(type)}
              </SidebarLink>
            ))}
          </ul>
        </li>
        <li>
          <div className="text-sm font-semibold text-slate-200">Country</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("country")}
              to={{
                pathname: location.pathname,
                search: buildQueryString(location.search, { country: "" }),
              }}
              size="small"
            >
              Any Country
            </SidebarLink>
            {MAJOR_COUNTRIES.map((country) => (
              <SidebarLink
                key={country}
                active={qs.get("country") === country}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    country,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {country}
              </SidebarLink>
            ))}
            {country && Object.keys(MAJOR_COUNTRIES).includes(country) && (
              <SidebarLink
                key={country}
                active={qs.get("country") === country}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    country,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {country}
              </SidebarLink>
            )}
          </ul>
        </li>
        {region && (
          <li>
            <div className="text-sm font-semibold text-slate-200">Region</div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <SidebarLink
                active={!qs.get("tag")}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    region: "",
                    cursor: null,
                  }),
                }}
                size="small"
              >
                Any Region
              </SidebarLink>
              <SidebarLink
                active={qs.get("region") === region}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    region,
                    cursor: null,
                  }),
                }}
                size="small"
              >
                {region}
              </SidebarLink>
            </ul>
          </li>
        )}
      </ul>
    </div>
  );
}
