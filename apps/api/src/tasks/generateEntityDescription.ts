import OpenAI from "openai";

import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const UNKNOWN_ENTITY_MARKER = "UNKNOWN_ENTITY_MARKER";

const MODEL = "gpt-3.5-turbo";

function generatePrompt(entityName: string) {
  return `
We want to learn more about the an entity known as "${entityName}", which may be whiskey distillery, bottler, or brand.

If you do not know about the entity, or are not certain its real, respond with only the text "${UNKNOWN_ENTITY_MARKER}" and nothing else, with no formatting.

Write a 200 word description. Focus on the history & origin, when it was founded, and include some interesting facts.

With all output, apply the following rules:

- Describe the entity as a distiller, bottler, or brand, whichever one it primarily is. Do not describe it as an entity.
- Be entirely truthful and use only facts.
- Do not use the name of the entity in the description.
- Format all text with markdown, and not use any headings.
`;
}

export default async function generateEntityDescription(
  entityName: string,
): Promise<string | null> {
  if (!config.OPENAI_API_KEY) return null;

  const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: generatePrompt(entityName),
      },
    ],
    temperature: 0.6,
  });

  const result = completion.choices[0].message.content;
  if (result === UNKNOWN_ENTITY_MARKER) return null;
  return result;
}
