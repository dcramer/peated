import { startInactiveSpan } from "@sentry/node";
import { Command } from "commander";
import { basename } from "path";

// const originalAction = Command.prototype.action;
// // Command.prototype.action(fn: (...args: any[]) => void | Promise<void>): this;
// Command.prototype.action = function (fn) {
//   return startSpan(
//     {
//       op: "command",
//       name: `commander.${this.name()}`,
//     },
//     (span) => {
//       return originalAction(fn);
//     },
//   );
// };

const program = new Command();

(() => {
  let span: any;

  program
    .name("peated")
    .description("CLI for assisting with Peated")
    .hook("preAction", async (thisCommand, actionCommand) => {
      const names = [actionCommand.name()];
      let currentCommand = actionCommand;
      while (currentCommand.parent) {
        names.push(currentCommand.parent.name());
        currentCommand = currentCommand.parent;
      }
      span = startInactiveSpan({
        op: "command",
        name: `commander.${names.reverse().join(".")}`,
      });
      span.setAttribute("process.parent_pid", process.ppid);
      span.setAttribute("process.pid", process.pid);
      span.setAttribute("process.executable.name", basename(process.argv0));
      span.setAttribute("process.executable.path", process.argv0);
      span.setAttribute("process.command_args", JSON.stringify(process.argv));
      span.setAttribute("process.runtime.version", process.version);
    })
    .hook("postAction", async (thisCommand, actionCommand) => {
      // TODO: we need status...
      if (span) {
        span.end();
        span = null;
      }
    });
})();

export default program;
