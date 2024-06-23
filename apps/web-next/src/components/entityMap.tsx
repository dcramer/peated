"use client";

import { type Entity } from "@peated/server/src/types";
import Link from "next/link";
import Map from "./map";

export default function EntityMap({
  entity,
  height = "200px",
  width = "100%",
}: {
  entity: Entity;
  height?: string;
  width?: string;
}) {
  if (!entity.location || !entity.address) return null;

  return (
    <Map
      height={height}
      width={width}
      position={entity.location}
      markerContent={
        <div className="flex flex-row items-center gap-x-2">
          <Link
            href={`http://maps.google.com/?q=${encodeURIComponent(`${entity.name}, ${entity.address}`)}`}
            target="_blank"
            className="text-highlight"
          >
            {entity.name}
            <br />
            {entity.address}
          </Link>
        </div>
      }
    />
  );
}
