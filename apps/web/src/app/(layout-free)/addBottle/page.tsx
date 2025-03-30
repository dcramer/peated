"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { Entity } from "@peated/server/types";
import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import Spinner from "@peated/web/components/spinner";
import useApi from "@peated/web/hooks/useApi";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AddBottle() {
  useVerifiedRequired();

  const router = useRouter();
  const searchParams = useSearchParams();
  const name = toTitleCase(searchParams.get("name") || "");
  const returnTo = searchParams.get("returnTo");

  const distiller = searchParams.get("distiller") || null;
  const brand = searchParams.get("brand") || null;
  const bottler = searchParams.get("bottler") || null;
  const series = searchParams.get("series") || null;

  const needsToLoad = Boolean(distiller || brand || bottler || series);
  const [loading, setLoading] = useState<boolean>(needsToLoad);

  const [initialData, setInitialData] = useState<Record<string, any>>({
    name,
  });

  const queryOrder: string[] = [];
  let initialQueries = trpc.useQueries((t) => {
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

  const seriesQuery = series
    ? trpc.bottleSeriesById.useQuery(Number(series))
    : null;

  const getQueryResult = (name: string): Entity | undefined => {
    const index = queryOrder.indexOf(name);
    if (index === -1) return undefined;
    return initialQueries[index].data;
  };

  useEffect(() => {
    if (
      loading &&
      !initialQueries.find((q) => q.isLoading) &&
      !seriesQuery?.isLoading
    ) {
      const distiller = getQueryResult("distiller");
      const brand = getQueryResult("brand");
      const bottler = getQueryResult("bottler");
      const series = seriesQuery?.data;
      setInitialData((initialData) => ({
        ...initialData,
        distillers: distiller ? [distiller] : [],
        brand,
        bottler,
        series,
      }));
      setLoading(false);
    }
  }, [initialQueries.find((q) => q.isLoading), seriesQuery?.isLoading]);

  const bottleCreateMutation = trpc.bottleCreate.useMutation();
  const api = useApi();
  const { flash } = useFlashMessages();

  if (loading) {
    return <Spinner />;
  }

  return (
    <BottleForm
      onSubmit={async ({ image, ...data }) => {
        const newBottle = await bottleCreateMutation.mutateAsync(data);
        if (image) {
          const blob = await toBlob(image);
          try {
            // TODO: switch to fetch maybe?
            await api.post(`/bottles/${newBottle.id}/image`, {
              data: {
                image: blob,
              },
            });
          } catch (err) {
            logError(err);
            flash(
              "There was an error uploading your image, but the bottle was saved.",
              "error",
            );
          }
        }

        if (returnTo) router.push(returnTo);
        else router.replace(`/bottles/${newBottle.id}/addTasting`);
      }}
      initialData={initialData}
      title="Add Bottle"
      returnTo={returnTo}
    />
  );
}
