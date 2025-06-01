import { toTitleCase } from "@peated/server/lib/strings";
import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import Spinner from "@peated/web/components/spinner";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueries } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/addBottle")({
  component: AddBottle,
  validateSearch: (search: Record<string, unknown>) => ({
    name: (search.name as string) || "",
    returnTo: (search.returnTo as string) || null,
    distiller: (search.distiller as string) || null,
    brand: (search.brand as string) || null,
    bottler: (search.bottler as string) || null,
    series: (search.series as string) || null,
  }),
  head: () => ({
    meta: [
      {
        title: "Add Bottle",
      },
      {
        name: "canonical",
        content: "https://peated.com/addBottle",
      },
    ],
  }),
});

function AddBottle() {
  useVerifiedRequired();

  const navigate = useNavigate();
  const orpc = useORPC();
  const {
    name: rawName,
    returnTo,
    distiller,
    brand,
    bottler,
    series,
  } = Route.useSearch();
  const name = toTitleCase(rawName);

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
        ...orpc.bottleSeries.details.queryOptions({
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
    orpc.bottles.create.mutationOptions()
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions()
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
              "error"
            );
          }
        }

        if (returnTo) navigate({ to: returnTo });
        else navigate({ to: `/bottles/${newBottle.id}/addTasting` });
      }}
      initialData={initialData}
      title="Add Bottle"
      returnTo={returnTo}
    />
  );
}
