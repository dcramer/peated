import { CATEGORY_LIST } from "@peated/shared/constants";
import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLocation } from "@remix-run/react";
import { dehydrate, QueryClient, useQuery } from "@tanstack/react-query";
import { type SitemapFunction } from "remix-sitemap";

import BottleTable from "~/components/bottleTable";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import SidebarLink from "~/components/sidebarLink";
import useApi from "~/hooks/useApi";
import type { ApiClient } from "~/lib/api";
import { formatCategoryName } from "~/lib/strings";
import { buildQueryString } from "~/lib/urls";
import { fetchBottles } from "~/queries/bottles";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

function buildQuery(api: ApiClient, queryString: URLSearchParams) {
  const page = queryString.get("page") || "1";
  const category = queryString.get("category") || undefined;
  const age = queryString.get("age") || undefined;
  const tag = queryString.get("tag") || undefined;
  const entity = queryString.get("entity") || undefined;
  const sort = queryString.get("sort") || "name";

  return {
    queryKey: [
      "bottles",
      page,
      "category",
      category,
      "age",
      age,
      "tag",
      tag,
      "entity",
      entity,
      "sort",
      sort,
    ],
    queryFn: () =>
      fetchBottles(api, {
        category,
        age,
        tag,
        entity,
        page,
        sort,
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
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </>
  );
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Bottles",
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

function FilterSidebar() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const age = qs.get("age");
  const entity = qs.get("entity");
  const tag = qs.get("tag");

  return (
    <div className="flex-coloverflow-y-auto mt-8 flex bg-slate-950 px-6 py-4">
      <ul role="list" className="flex flex-1 flex-col gap-y-7">
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
                  page: 1,
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
                    page: 1,
                  }),
                }}
                size="small"
              >
                {formatCategoryName(category)}
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
                    page: 1,
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
                    page: 1,
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
                    page: 1,
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
                  search: buildQueryString(location.search, { age, page: 1 }),
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
            <div className="text-sm font-semibold text-slate-200">
              Flavor Profile
            </div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <SidebarLink
                active={!qs.get("tag")}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    tag: "",
                    page: 1,
                  }),
                }}
                size="small"
              >
                Any Flavors
              </SidebarLink>
              <SidebarLink
                active={qs.get("tag") === tag}
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, { tag, page: 1 }),
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

export default function BottleList() {
  return (
    <Layout rightSidebar={<FilterSidebar />}>
      <QueryBoundary>
        <Content />
      </QueryBoundary>
    </Layout>
  );
}
