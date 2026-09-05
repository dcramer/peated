import { base } from "@peated/server/orpc";
import coverage from "./coverage";
import list from "./list";

export default base.router({ list, coverage });
