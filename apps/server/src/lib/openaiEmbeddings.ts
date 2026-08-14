import config from "@peated/server/config";
import {
  createOpenAIClient,
  type AIGatewayWorkload,
} from "@peated/server/lib/openaiClient";

export async function getOpenAIEmbedding(
  input: string,
  { workload = "application" }: { workload?: AIGatewayWorkload } = {},
): Promise<number[]> {
  const response = await createOpenAIClient({ workload }).embeddings.create({
    model: config.OPENAI_EMBEDDING_MODEL,
    input,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned empty embedding output");
  }

  return embedding;
}
