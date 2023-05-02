import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle, Brand } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import classNames from "../lib/classNames";
import { formatCategoryName } from "../lib/strings";
import { Link } from "react-router-dom";

type LoaderData = {
  brand: Brand;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { brandId },
}): Promise<LoaderData> => {
  if (!brandId) throw new Error("Missing brandId");
  const brand = await api.get(`/brands/${brandId}`);
  const bottleList = await api.get(`/bottles`, {
    query: { brand: brand.id },
  });

  return { brand, bottleList };
};

export default function BrandDetails() {
  const { brand, bottleList } = useLoaderData() as LoaderData;

  const stats = [
    { name: "Bottles", value: "1,234" },
    { name: "Rating", value: 4.5 },
  ];

  return (
    <Layout>
      <div className="border border-gray-200">
        <div className="flex flex-col items-start justify-between gap-x-8 gap-y-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <div className="space-y-1 flex-1">
              <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
                {brand.name}
              </h1>
              <p className="text-xs font-light text-gray-500">
                Located in {brand.country}
                {brand.region && <span> &middot; {brand.region}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
          {stats.map((stat, statIdx) => (
            <div
              key={stat.name}
              className={classNames(
                statIdx % 2 === 1
                  ? "sm:border-l"
                  : statIdx === 2
                  ? "lg:border-l"
                  : "",
                "border-t border-gray-200 py-6 px-4 sm:px-6 lg:px-8"
              )}
            >
              <p className="text-base leading-7 text-gray-400">{stat.name}</p>
              <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
      <h2 className="text-lg font-semibold leading-6 my-6 text-gray-900">
        Bottles
      </h2>
      <table className="min-w-full">
        <colgroup>
          <col className="w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
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
              {" "}
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
