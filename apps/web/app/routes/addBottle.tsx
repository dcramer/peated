import { useLocation, useNavigate } from "@remix-run/react";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SitemapFunction } from "remix-sitemap";

import { toTitleCase } from "@peated/core/lib/strings";

import type { Entity } from "@peated/core/types";
import { type LoaderFunction, type MetaFunction } from "@remix-run/node";
import BottleForm from "~/components/bottleForm";
import Spinner from "~/components/spinner";
import useApi from "~/hooks/useApi";
import { redirectToAuth } from "~/lib/auth.server";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = ({ request, context }) => {
  if (!context.user) return redirectToAuth({ request });

  return null;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Bottle",
    },
  ];
};

export default function AddBottle() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const name = toTitleCase(qs.get("name") || "");

  const distiller = qs.get("distiller") || null;
  const brand = qs.get("brand") || null;
  const bottler = qs.get("bottler") || null;

  const needsToLoad = Boolean(distiller || brand || bottler);
  const [loading, setLoading] = useState<boolean>(needsToLoad);

  const [initialData, setInitialData] = useState<Record<string, any>>({
    name,
  });

  const queries = [];
  const queryOrder: string[] = [];
  if (distiller) {
    queryOrder.push("distiller");
    queries.push({
      queryKey: ["entity", distiller],
      queryFn: async (): Promise<Entity> => {
        return await api.get(`/entities/${distiller}`);
      },
    });
  }
  if (brand) {
    queryOrder.push("brand");
    queries.push({
      queryKey: ["entity", brand],
      queryFn: async (): Promise<Entity> => {
        return await api.get(`/entities/${brand}`);
      },
    });
  }
  if (bottler) {
    queryOrder.push("bottler");
    queries.push({
      queryKey: ["entity", bottler],
      queryFn: async (): Promise<Entity> => {
        return await api.get(`/entities/${bottler}`);
      },
    });
  }

  const initialQueries = useQueries({
    queries: queries,
  });

  const getQueryResult = (name: string): Entity | undefined => {
    const index = queryOrder.indexOf(name);
    if (index === -1) return undefined;
    return initialQueries[index].data;
  };

  useEffect(() => {
    if (loading && !initialQueries.find((q) => q.isLoading)) {
      const distiller = getQueryResult("distiller");
      const brand = getQueryResult("brand");
      const bottler = getQueryResult("bottler");
      setInitialData((initialData) => ({
        ...initialData,
        distillers: distiller ? [distiller] : [],
        brand,
        bottler,
      }));
      setLoading(false);
    }
  }, [initialQueries.find((q) => q.isLoading)]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <BottleForm
      onSubmit={async (data) => {
        const newBottle = await api.post(`/bottles`, { data });
        navigate(`/bottles/${newBottle.id}/addTasting`, {
          replace: true,
        });
      }}
      initialData={initialData}
      title="Add Bottle"
    />
  );
}
