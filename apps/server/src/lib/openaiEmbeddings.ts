import config from "@peated/server/config";
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-large";

function createOpenAIClient() {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

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
