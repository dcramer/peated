import generateEntityDetails from "./generateEntityDetails";
import geocodeEntityLocation from "./geocodeEntityLocation";
import indexEntitySearchVectors from "./indexEntitySearchVectors";

export default async ({ entityId }: { entityId: number }) => {
  generateEntityDetails({ entityId });
  indexEntitySearchVectors({ entityId });
  geocodeEntityLocation({ entityId });
};
