import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle, Entity } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import BottleTable from "../components/bottleTable";
import Button from "../components/button";

type EntityWithStats = Entity & {
  stats: {
    bottles: number;
  };
};

type LoaderData = {
  brand: EntityWithStats;
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
    { name: "Bottles", value: brand.stats.bottles.toLocaleString() },
  ];

  return (
    <Layout gutter>
      <div className="min-w-full flex flex-wrap sm:flex-nowrap my-8 gap-y-4">
        <div className="space-y-1 flex-1 w-full sm:w-auto flex flex-col items-center sm:items-start">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {brand.name}
          </h1>
          <p className="text-sm font-light text-gray-500">
            Located in {brand.country}
            {brand.region && <span> &middot; {brand.region}</span>}
          </p>
        </div>
      </div>

      <div className="my-8 justify-center sm:justify-start flex gap-4">
        <Button to={`/brands/${brand.id}/edit`}>Edit Brand</Button>
      </div>

      <div className="my-8 grid gap-3 grid-cols-1 text-center sm:text-left items-center">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <BottleTable bottleList={bottleList} />
    </Layout>
  );
}
