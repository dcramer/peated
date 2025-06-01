import type { Entity } from "@peated/server/types";
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
      markers={[
        {
          position: entity.location,
          name: entity.name,
          address: entity.address,
          useAsPosition: true,
        },
      ]}
    />
  );
}
