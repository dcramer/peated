import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";
import BottleTable from "../components/bottleTable";
import Button from "../components/button";
import Chip from "../components/chip";
import Layout from "../components/layout";
import useAuth from "../hooks/useAuth";
import api from "../lib/api";
import type { Bottle, Entity } from "../types";

type LoaderData = {
  entity: Entity;
  bottleList: Bottle[];
};

export const loader: LoaderFunction = async ({
  params: { entityId },
}): Promise<LoaderData> => {
  if (!entityId) throw new Error("Missing entityId");
  const entity = await api.get(`/entities/${entityId}`);
  const { results: bottleList } = await api.get(`/bottles`, {
    query: { entity: entity.id },
  });

  return { entity, bottleList };
};

export default function EntityDetails() {
  const { entity, bottleList } = useLoaderData() as LoaderData;
  const { user: currentUser } = useAuth();

  const stats = [
    { name: "Bottles", value: entity.totalBottles.toLocaleString() },
  ];

  return (
    <Layout>
      <div className="mb-4 mt-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-1 flex-col items-center space-y-1 sm:items-start">
          <h1 className="mb-2 flex gap-x-3 text-3xl font-semibold leading-7">
            {entity.name}
          </h1>
          <p className="text-light text-sm font-light">
            Located in {entity.country}
            {entity.region && <span> &middot; {entity.region}</span>}
          </p>
        </div>
        <div className="sm:justify-left mb-4 flex w-full justify-center space-x-2 sm:w-auto">
          {entity.type.sort().map((t) => (
            <Chip key={t} size="small" color="highlight">
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="my-8 flex justify-center gap-4 sm:justify-start">
        {currentUser?.mod && (
          <Menu as="div" className="menu">
            <Menu.Button as={Button}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Menu.Button>
            <Menu.Items className="absolute left-0 z-10 mt-2 w-64 origin-top-left">
              <Menu.Item as={Link} to={`/entities/${entity.id}/edit`}>
                Edit Entity
              </Menu.Item>
            </Menu.Items>
          </Menu>
        )}
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

      <BottleTable
        bottleList={bottleList}
        groupBy={(bottle) => bottle.brand}
        groupTo={(group) => `/entities/${group.id}`}
      />
    </Layout>
  );
}
