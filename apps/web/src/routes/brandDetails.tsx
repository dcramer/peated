import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import BottleTable from "../components/bottleTable";
import Button from "../components/button";
import Layout from "../components/layout";
import api from "../lib/api";
import type { Bottle, Entity } from "../types";

type LoaderData = {
  brand: Entity;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { brandId },
}): Promise<LoaderData> => {
  if (!brandId) throw new Error("Missing brandId");
  const brand = await api.get(`/entities/${brandId}`);
  const { results: bottleList } = await api.get(`/bottles`, {
    query: { brand: brand.id },
  });

  return { brand, bottleList };
};

export default function BrandDetails() {
  const { brand, bottleList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Bottles", value: brand.totalBottles.toLocaleString() },
  ];

  return (
    <Layout gutter>
      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-1 flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <h1 className="mb-2 flex gap-x-3 text-3xl font-semibold leading-7">
            {brand.name}
          </h1>
          <p className="text-sm font-light text-gray-500">
            Located in {brand.country}
            {brand.region && <span> &middot; {brand.region}</span>}
          </p>
        </div>
      </div>

      <div className="my-8 flex justify-center gap-4 sm:justify-start">
        <Button to={`/brands/${brand.id}/edit`}>Edit Brand</Button>
      </div>

      <div className="my-8 grid grid-cols-1 items-center gap-3 text-center sm:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-peated-light leading-7">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <BottleTable bottleList={bottleList} />
    </Layout>
  );
}
