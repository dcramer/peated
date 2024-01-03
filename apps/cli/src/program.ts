import { Command } from "commander";
import { shutdownClient } from "../../server/src/jobs";

const program = new Command();

program
  .name("bottles")
  .description("CLI for assisting with Peated")
  .hook("postAction", async () => {
    await shutdownClient();
  });

export default program;
