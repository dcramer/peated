import { runJob } from ".";

export default async ({ name }: { name: string }) => {
  runJob("IndexBottleAlias", { name });
};
