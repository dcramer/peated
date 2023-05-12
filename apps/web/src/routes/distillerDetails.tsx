import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import BottleTable from "../components/bottleTable";
import Button from "../components/button";
import Layout from "../components/layout";
import api from "../lib/api";
import type { Bottle, Entity } from "../types";

type LoaderData = {
  distiller: Entity;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { distillerId },
}): Promise<LoaderData> => {
  if (!distillerId) throw new Error("Missing distillerId");
  const distiller = await api.get(`/entities/${distillerId}`);
  const { results: bottleList } = await api.get(`/bottles`, {
    query: { distiller: distiller.id },
  });

  return { distiller, bottleList };
};

export default function DistillerDetails() {
  const { distiller, bottleList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Bottles", value: distiller.totalBottles.toLocaleString() },
  ];

  return (
    <Layout gutter>
      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center sm:w-auto sm:flex-1">
          <div className="flex w-full flex-1 flex-col items-center space-y-1 sm:w-auto sm:items-start">
            <h1 className="text-peated mb-2 flex gap-x-3 text-3xl font-semibold leading-7">
              {distiller.name}
            </h1>
            <p className="text-sm font-light text-gray-500">
              Located in {distiller.country}
              {distiller.region && <span> &middot; {distiller.region}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="my-8 flex justify-center gap-4 sm:justify-start">
        <Button to={`/distillers/${distiller.id}/edit`}>Edit Distiller</Button>
      </div>

      <div className="my-8 grid grid-cols-1 items-center gap-3 text-center sm:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="leading-7 text-gray-400">{stat.name}</p>
            <p className="text-peated order-first text-3xl font-semibold tracking-tight sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <BottleTable
        bottleList={bottleList}
        groupBy={(bottle) => bottle.brand}
        groupTo={(group) => `/brands/${group.id}`}
      />
    </Layout>
  );
}
