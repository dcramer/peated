import { shutdownClient } from "@peated/server/jobs/client";
import { Command } from "commander";

const program = new Command();

program
  .name("peated")
  .description("CLI for assisting with Peated")
  .hook("postAction", async () => {
    await shutdownClient();
  });

export default program;
