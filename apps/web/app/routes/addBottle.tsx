import { toTitleCase } from "@peated/server/lib/strings";
import type { Entity } from "@peated/server/types";
import { type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { SitemapFunction } from "remix-sitemap";
import BottleForm from "~/components/bottleForm";
import Spinner from "~/components/spinner";
import { redirectToAuth } from "~/lib/auth.server";
import { trpc } from "~/lib/trpc";

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

  const queryOrder: string[] = [];
  const initialQueries = trpc.useQueries((t) => {
    const rv = [];
    if (distiller) {
      queryOrder.push("distiller");
      rv.push(t.entityById(Number(distiller)));
    }
    if (brand) {
      queryOrder.push("brand");
      rv.push(t.entityById(Number(brand)));
    }
    if (bottler) {
      queryOrder.push("bottler");
      rv.push(t.entityById(Number(bottler)));
    }
    return rv;
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

  const bottleCreateMutation = trpc.bottleCreate.useMutation();

  if (loading) {
    return <Spinner />;
  }

  return (
    <BottleForm
      onSubmit={async (data) => {
        const newBottle = await bottleCreateMutation.mutateAsync(data);
        navigate(`/bottles/${newBottle.id}/addTasting`, {
          replace: true,
        });
      }}
      initialData={initialData}
      title="Add Bottle"
    />
  );
}
