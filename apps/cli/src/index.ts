#! /usr/bin/env node

import "./sentry";

import "./commands";
import program from "./program";

export { program };

program.parseAsync();
