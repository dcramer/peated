import { useParams } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";
import { ReactComponent as EntityIcon } from "../assets/entity.svg";
import BottleTable from "../components/bottleTable";
import Button from "../components/button";
import Chip from "../components/chip";
import Layout from "../components/layout";
import useAuth from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { Bottle, Entity, Paginated } from "../types";

export default function EntityDetails() {
  const { entityId } = useParams();
  const { data: entity } = useSuspenseQuery(
    ["entity", entityId],
    (): Promise<Entity> => api.get(`/entities/${entityId}`),
  );

  const {
    data: { results: bottleList },
  } = useSuspenseQuery(
    ["entity", entityId, "bottles"],
    (): Promise<Paginated<Bottle>> =>
      api.get(`/bottles`, {
        query: { entity: entityId },
      }),
  );

  const { user: currentUser } = useAuth();

  const stats = [
    { name: "Bottles", value: entity.totalBottles.toLocaleString() },
  ];

  return (
    <Layout>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4  sm:flex-nowrap sm:py-0">
        <EntityIcon className="h-14 w-auto" />

        <div className="w-full flex-1 flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <h1 className="mb-2 truncate text-3xl font-semibold leading-7">
            {entity.name}
          </h1>
          <p className="truncate text-center text-slate-500 sm:text-left">
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
        <Button
          to={`/addBottle?${
            entity.type.indexOf("brand") !== -1 ? `brand=${entity.id}&` : ""
          }${
            entity.type.indexOf("distiller") !== -1
              ? `distiller=${entity.id}`
              : ""
          }${
            entity.type.indexOf("bottler") !== -1 ? `bottler=${entity.id}` : ""
          }`}
          color="primary"
        >
          Add a Bottle
        </Button>

        {currentUser?.mod && (
          <Menu as="div" className="menu">
            <Menu.Button as={Button}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
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
