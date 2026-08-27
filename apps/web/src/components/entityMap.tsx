import { type Entity } from "@peated/server/types";
import { toLeafletLatLng } from "@peated/web/lib/coordinates";
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
  const position = toLeafletLatLng(entity.location);

  return (
    <Map
      height={height}
      width={width}
      position={position}
      markers={[
        {
          position,
          name: entity.name,
          address: entity.address,
          useAsPosition: true,
        },
      ]}
    />
  );
}
