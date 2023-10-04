import OpenAI from "openai";

import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const MODEL = "gpt-3.5-turbo";

function generatePrompt(bottleName: string) {
  return `
Write a 100 word description for the whiskey "${bottleName}". Focus on its history & origin and production technique. Do not include tasting notes.

If you do not know about the bottle of whiskey, or are not certain its real, respond with only the text "UNKNOWN_BOTTLE" and nothing else, with no formatting.

Write an additional description for it's tasting notes, including the nose, palate, and finish. 

Format all text with markdown, and not use headings.
Do not use the name of the whiskey in tasting notes.
Format the tasting notes into three sections using bullet points, with each segment being in bold.
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
  if (result === "UNKNOWN_BOTTLE") return null;
  return result;
}
