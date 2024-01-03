#! /usr/bin/env node

import "./commands";
import program from "./program";
import "./sentry";

export { program };

program.parseAsync();
