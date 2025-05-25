"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import Spinner from "@peated/web/components/spinner";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AddBottle() {
  useVerifiedRequired();

  const router = useRouter();
  const orpc = useORPC();
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

  const queries = useQueries({
    queries: [
      {
        ...orpc.entities.details.queryOptions({
          input: { entity: Number(distiller) },
        }),
        enabled: !!distiller,
      },
      {
        ...orpc.entities.details.queryOptions({
          input: { entity: Number(brand) },
        }),
        enabled: !!brand,
      },
      {
        ...orpc.entities.details.queryOptions({
          input: { entity: Number(bottler) },
        }),
        enabled: !!bottler,
      },
      {
        ...orpc.bottles.series.details.queryOptions({
          input: { series: Number(series) },
        }),
        enabled: !!series,
      },
    ],
  });

  const [distillerQuery, brandQuery, bottlerQuery, seriesQuery] = queries;

  useEffect(() => {
    if (loading && !queries.some((q) => q.isLoading)) {
      setInitialData((initialData) => ({
        ...initialData,
        distillers: distillerQuery.data ? [distillerQuery.data] : [],
        brand: brandQuery.data,
        bottler: bottlerQuery.data,
        series: seriesQuery.data,
      }));
      setLoading(false);
    }
  }, [queries.map((q) => q.isLoading)]);

  const bottleCreateMutation = useMutation(
    orpc.bottles.create.mutationOptions(),
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions(),
  );
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
            await bottleImageUpdateMutation.mutateAsync({
              bottle: newBottle.id,
              file: blob,
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
