import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle, Distiller } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import { formatCategoryName } from "../lib/strings";
import { Link } from "react-router-dom";

type LoaderData = {
  distiller: Distiller;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { distillerId },
}): Promise<LoaderData> => {
  if (!distillerId) throw new Error("Missing distillerId");
  const distiller = await api.get(`/distillers/${distillerId}`);
  const bottleList = await api.get(`/bottles`, {
    query: { distiller: distiller.id },
  });

  return { distiller, bottleList };
};

export default function DistillerDetails() {
  const { distiller, bottleList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Bottles", value: "1,234" },
    { name: "Rating", value: 4.5 },
  ];

  return (
    <Layout>
      <div className="flex flex-col items-start justify-between gap-x-8 sm:flex-row sm:items-center">
        <div className="space-y-1 flex-1">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {distiller.name}
          </h1>
          <p className="text-xs font-light text-gray-500">
            Located in {distiller.country}
            {distiller.region && <span> &middot; {distiller.region}</span>}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-base leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold leading-6 my-6 mt-16 text-gray-900">
        Bottles
      </h2>
      <table className="min-w-full">
        <colgroup>
          <col className="w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="border-b border-gray-300 text-gray-900">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Bottle
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-right text-sm font-semibold text-gray-900 sm:table-cell"
            >
              Category
            </th>
            <th
              scope="col"
              className="py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900 sm:pr-0"
            >
              Age
            </th>
          </tr>
        </thead>
        <tbody>
          {bottleList.map((bottle, idx) => (
            <tr key={bottle.id} className="border-b border-gray-200">
              <td className="max-w-0 py-5 pl-4 pr-3 text-sm sm:pl-0">
                <Link
                  to={`/bottles/${bottle.id}`}
                  className="font-bold text-peated hover:underline"
                >
                  {bottle.name}
                </Link>
                <div className="mt-1 truncate text-gray-500">
                  {bottle.series}
                </div>
              </td>
              <td className="hidden px-3 py-5 text-right text-sm text-gray-500 sm:table-cell">
                {formatCategoryName(bottle.category)}
              </td>
              <td className="hidden py-5 pl-3 pr-4 text-right text-sm text-gray-500 sm:pr-0 sm:table-cell">
                {bottle.statedAge && `${bottle.statedAge} years`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
