import generateBottleDetails from "./generateBottleDetails";
import indexBottleSearchVectors from "./indexBottleSearchVectors";

export default async ({ bottleId }: { bottleId: number }) => {
  generateBottleDetails({ bottleId });
  indexBottleSearchVectors({ bottleId });
};
