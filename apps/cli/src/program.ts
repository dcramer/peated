import * as Sentry from "@sentry/node-experimental";
import { Command } from "commander";
import { shutdownClient } from "../../server/src/jobs";

const program = new Command();

(() => {
  let span: any;

  program
    .name("peated")
    .description("CLI for assisting with Peated")
    .hook("preSubcommand", async (thisCommand, subcommand) => {
      // const parent = Sentry.getActiveSpan();
      span = Sentry.startInactiveSpan({
        op: "command",
        name: `commander.${subcommand.name()}`,
      });
    })
    .hook("postAction", async (thisCommand) => {
      await shutdownClient();
      if (span) {
        span.end();
        span = null;
      }
    });
})();

export default program;
