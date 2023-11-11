import faktory, { type Client } from "faktory-worker";

let client: Client | null = null;

// process.on("SIGTERM", () => shutdownClient());
// process.on("SIGINT", () => shutdownClient());
// process.on("SIGUSR1", () => shutdownClient());
// process.on("SIGUSR2", () => shutdownClient());
// process.on("uncaughtException", () => shutdownClient());
// process.on("beforeExit", () => shutdownClient());

export async function getClient() {
  if (!client) {
    client = await faktory.connect();
  }
  return client;
}

export async function hasActiveClient() {
  return !!client;
}

export async function shutdownClient() {
  if (!client) return;
  await client.close();
  client = null;
}

export type JobName =
  | "GenerateBottleDetails"
  | "GenerateEntityDetails"
  | "NotifyDiscordOnTasting"
  | "ScrapeAstorWines"
  | "ScrapeHealthySpirits"
  | "ScrapeTotalWine"
  | "ScrapeWoodenCork";

export default async function pushJob(jobName: JobName, args?: any) {
  const client = await getClient();
  await client.job(jobName, args).push();
}
