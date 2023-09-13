import type { LoaderFunction } from "@remix-run/node";
import { json, type V2_MetaFunction } from "@remix-run/node";
import { useLocation } from "@remix-run/react";
import { dehydrate, QueryClient, useQuery } from "@tanstack/react-query";

import { ENTITY_TYPE_LIST, MAJOR_COUNTRIES } from "@peated/shared/constants";
import { toTitleCase } from "@peated/shared/lib/strings";
import type { EntityType } from "@peated/shared/types";
import EmptyActivity from "~/components/emptyActivity";
import EntityTable from "~/components/entityTable";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import SidebarLink from "~/components/sidebarLink";
import useApi from "~/hooks/useApi";
import type { ApiClient } from "~/lib/api";
import { buildQueryString } from "~/lib/urls";
import { fetchEntities } from "~/queries/entities";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Brands, Bottler, and Distillers",
    },
  ];
};

export const loader: LoaderFunction = async ({ context, request }) => {
  const queryClient = new QueryClient();

  const url = new URL(request.url);
  const query = buildQuery(context.api, url.searchParams);

  await queryClient.prefetchQuery(query);

  return json({ dehydratedState: dehydrate(queryClient) });
};

export default function Entities() {
  return (
    <Layout rightSidebar={<FilterSidebar />}>
      <QueryBoundary>
        <Content />
      </QueryBoundary>
    </Layout>
  );
}

export function buildQuery(api: ApiClient, queryString: URLSearchParams) {
  const page = queryString.get("page") || "1";
  const type = queryString.get("type") || undefined;
  const country = queryString.get("country") || undefined;
  const region = queryString.get("region") || undefined;
  const sort = queryString.get("sort") || "name";

  return {
    queryKey: [
      "entities",
      page,
      "type",
      type,
      "country",
      country,
      "region",
      region,
      "sort",
      sort,
    ],
    queryFn: () =>
      fetchEntities(api, {
        type: type as EntityType,
        country,
        region,
        sort,
        page,
      }),
  };
}

const Content = () => {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const api = useApi();
  const query = buildQuery(api, qs);
  const { data } = useQuery(query);

  if (!data) return null;

  return (
    <>
      {data.results.length > 0 ? (
        <EntityTable entityList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </>
  );
};

function FilterSidebar() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const country = qs.get("country");
  const region = qs.get("region");

  return (
    <div className="flex-coloverflow-y-auto mt-8 flex bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-1 flex-col gap-y-7">
        <li>
          <div className="text-sm font-semibold text-slate-200">Type</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <SidebarLink
              active={!qs.get("type")}
              to={{
                pathname: location.pathname,
                search: buildQueryString(location.search, {
                  type: "",
                  page: 1,
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
                    page: 1,
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
                    page: "1",
                  }),
                }}
                size="small"
              >
                {country}
              </SidebarLink>
            ))}
            {country &&
              Object.keys(MAJOR_COUNTRIES).indexOf(country) !== -1 && (
                <SidebarLink
                  key={country}
                  active={qs.get("country") === country}
                  to={{
                    pathname: location.pathname,
                    search: buildQueryString(location.search, {
                      country,
                      page: "1",
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
                    page: "1",
                  }),
                }}
                size="small"
              >
                Any Flavors
              </SidebarLink>
              <SidebarLink
                active={qs.get("region") === region}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    region,
                    page: "1",
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
