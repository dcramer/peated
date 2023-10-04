import OpenAI from "openai";

import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const UNKNOWN_BOTTLE_MARKER = "UNKNOWN_BOTTLE_MARKER";

const MODEL = "gpt-3.5-turbo";

function generatePrompt(bottleName: string) {
  return `
We want to learn more about the whiskey "${bottleName}".

First, write a 100 word description. Focus on the history & origin and production technique unique to the whiskey. Do not include tasting notes.

Second, describe the tasting notes, including the nose, palate, and finish. Be concise and and focus on the smell and taste.

With all output, apply the following rules:

- If you do not know about the bottle of whiskey, or are not certain its real, respond with only the text "${UNKNOWN_BOTTLE_MARKER}" and nothing else, with no formatting.
- Be entirely truthful.
- Do not use the name of the whiskey in the description or tasting notes.
- Format all text with markdown, and not use any headings.
- Format the tasting notes into three sections using bullet points, with each segment being in bold.

`;
}

export default async function generateBottleDescription(
  bottleName: string,
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
        content: generatePrompt(bottleName),
      },
    ],
    temperature: 0.6,
  });

  const result = completion.choices[0].message.content;
  if (result === UNKNOWN_BOTTLE_MARKER) return null;
  return result;
}
