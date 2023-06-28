import { CATEGORY_LIST } from "@peated/shared/constants";
import type { Paginated } from "@peated/shared/types";
import {
  json,
  type LoaderFunction,
  type V2_MetaFunction,
} from "@remix-run/node";
import { useLocation } from "@remix-run/react";
import { dehydrate, QueryClient, useQuery } from "@tanstack/react-query";

import BottleTable from "~/components/bottleTable";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import SidebarLink from "~/components/sidebarLink";
import useApi from "~/hooks/useApi";
import type { ApiClient } from "~/lib/api";
import { formatCategoryName } from "~/lib/strings";
import type { Bottle } from "~/types";

function buildQuery(api: ApiClient, queryString: URLSearchParams) {
  const page = queryString.get("page") || 1;
  const category = queryString.get("category") || undefined;
  const age = queryString.get("age") || undefined;
  const tag = queryString.get("tag") || undefined;
  const entity = queryString.get("entity") || undefined;

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
    ],
    queryFn: (): Promise<Paginated<Bottle>> =>
      api.get("/bottles", {
        query: {
          category,
          age,
          tag,
          entity,
          page,
          sort: "name",
        },
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

export const meta: V2_MetaFunction = () => {
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

function buildQueryString(search: string, newParams: Record<string, any>) {
  const qs = new URLSearchParams(search);
  for (const [key, value] of Object.entries(newParams)) {
    qs.set(key, value);
  }
  return qs.toString();
}

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
          <div className="text-sm font-semibold text-slate-200">Category</div>
          <ul role="list" className="-mx-3 mt-2 space-y-1">
            <li>
              <SidebarLink
                active={!qs.get("category")}
                to={{
                  pathname: "/bottles",
                  search: buildQueryString(location.search, { category: "" }),
                }}
                size="small"
              >
                Any Category
              </SidebarLink>
            </li>
            {CATEGORY_LIST.map((category) => (
              <li key={category}>
                <SidebarLink
                  active={qs.get("category") === category}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { category }),
                  }}
                  size="small"
                >
                  {formatCategoryName(category)}
                </SidebarLink>
              </li>
            ))}
          </ul>
        </li>
        {entity && (
          <li>
            <div className="text-sm font-semibold text-slate-200">
              Relationship
            </div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <li>
                <SidebarLink
                  active={!qs.get("entity")}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { entity: "" }),
                  }}
                  size="small"
                >
                  Any Relationship
                </SidebarLink>
              </li>
              <li>
                <SidebarLink
                  active={qs.get("entity") === entity}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { entity }),
                  }}
                  size="small"
                >
                  TODO: {entity}
                </SidebarLink>
              </li>
            </ul>
          </li>
        )}
        {age && (
          <li>
            <div className="text-sm font-semibold text-slate-200">Age</div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <li>
                <SidebarLink
                  active={!qs.get("age")}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { age: "" }),
                  }}
                  size="small"
                >
                  Any Age
                </SidebarLink>
              </li>
              <li>
                <SidebarLink
                  active={qs.get("age") === age}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { age }),
                  }}
                  size="small"
                >
                  {age} years
                </SidebarLink>
              </li>
            </ul>
          </li>
        )}
        {tag && (
          <li>
            <div className="text-sm font-semibold text-slate-200">
              Flavor Profile
            </div>
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              <li>
                <SidebarLink
                  active={!qs.get("tag")}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { tag: "" }),
                  }}
                  size="small"
                >
                  Any Flavors
                </SidebarLink>
              </li>
              <li>
                <SidebarLink
                  active={qs.get("tag") === tag}
                  to={{
                    pathname: "/bottles",
                    search: buildQueryString(location.search, { tag }),
                  }}
                  size="small"
                >
                  {tag}
                </SidebarLink>
              </li>
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
