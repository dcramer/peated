import { createOpenAIClient } from "@peated/server/lib/openaiClient";

const EMBEDDING_MODEL = "text-embedding-3-large";

export async function getOpenAIEmbedding(input: string): Promise<number[]> {
  const response = await createOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned empty embedding output");
  }

  return embedding;
}
