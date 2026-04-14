export { BottleClassificationError } from "@peated/bottle-classifier/error";
export type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import { runBottleClassifierAgent as runBottleClassifierAgentWithServerAdapters } from "./service";

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  return await runBottleClassifierAgentWithServerAdapters(input);
}
