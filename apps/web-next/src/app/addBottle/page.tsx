"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { Entity } from "@peated/server/types";
import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import { trpcClient } from "@peated/web-next/lib/trpc";
import BottleForm from "@peated/web/components/bottleForm";
import Spinner from "@peated/web/components/spinner";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AddBottle() {
  useAuthRequired();

  const router = useRouter();
  const qs = useSearchParams();
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
  const initialQueries = trpcClient.useQueries((t) => {
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
        router.replace(`/bottles/${newBottle.id}/addTasting`);
      }}
      initialData={initialData}
      title="Add Bottle"
    />
  );
}
