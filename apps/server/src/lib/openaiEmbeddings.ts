import config from "@peated/server/config";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";

export async function getOpenAIEmbedding(input: string): Promise<number[]> {
  const response = await createOpenAIClient().embeddings.create({
    model: config.OPENAI_EMBEDDING_MODEL,
    input,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned empty embedding output");
  }

  return embedding;
}
