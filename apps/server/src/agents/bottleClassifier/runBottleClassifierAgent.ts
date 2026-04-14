export type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/classifierRuntime";
export { BottleClassificationError } from "@peated/bottle-classifier/error";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/classifierRuntime";
import { runBottleClassifierAgent as runBottleClassifierAgentWithServerAdapters } from "./service";

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  return await runBottleClassifierAgentWithServerAdapters(input);
}
