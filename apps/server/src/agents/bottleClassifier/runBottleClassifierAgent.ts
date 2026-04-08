export { BottleClassificationError } from "@peated/bottle-classifier";
export type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier";
import { runBottleClassifierAgent as runBottleClassifierAgentWithServerAdapters } from "./service";

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  return await runBottleClassifierAgentWithServerAdapters(input);
}
