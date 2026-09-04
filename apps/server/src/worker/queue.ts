import { Queue } from "bullmq";
import { getConnection } from "./redis";

export async function getQueue(
  name = "default",
  connection: Awaited<ReturnType<typeof getConnection>> | null = null,
) {
  return new Queue(name, {
    connection: connection || (await getConnection()),
  });
}
