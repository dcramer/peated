import OpenAI from "openai";

import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const UNKNOWN_ENTITY_MARKER = "UNKNOWN_ENTITY_MARKER";

const MODEL = "gpt-3.5-turbo";

// TODO: we can just pass in the information on if its a distillery or brand, and adjust the prompt accordingly?
function generatePrompt(entityName: string) {
  return `
We want to learn more about the entity "${entityName}", which may be whiskey distillery, a whiskey bottler, or brand of whiskey.

If you cannot identify the entity, or are not certain it is real, respond with only the text "${UNKNOWN_ENTITY_MARKER}" and nothing else. Do not format the text in this case..

Write a 200 word description. Focus on the history & origin, when it was founded, and what makes it different than its competitors.

With all output, apply the following rules:

- Describe the entity as a distiller, bottler, or brand, whichever one it primarily is. Do not describe it as a "entity".
- Be entirely truthful and use only facts.
- Do not use the name of the entity in the description.
- Format all text with markdown, and not use any headings.
- Keep the tone of the description somewhat formal, and without opinion.
- Do not format the entity name using quotation marks.
- If the entity is from Scotland, spell Whiskey as "Whisky".
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
