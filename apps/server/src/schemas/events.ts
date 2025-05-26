import { z } from "zod";
import { CountrySchema } from "./countries";
import { PointSchema } from "./shared";

export const EventSchema = z.object({
  id: z.number().describe("Unique identifier for the event"),
  name: z.string().trim().min(1, "Required").describe("Name of the event"),
  dateStart: z.string().date().describe("Start date of the event"),
  dateEnd: z
    .string()
    .date()
    .nullable()
    .default(null)
    .describe("End date of the event"),
  repeats: z
    .boolean()
    .default(false)
    .describe("Whether this is a recurring event"),
  website: z
    .string()
    .url()
    .nullable()
    .default(null)
    .describe("Official website URL for the event"),
  description: z
    .string()
    .nullable()
    .default(null)
    .describe("Description of the event"),
  country: CountrySchema.nullable()
    .default(null)
    .describe("Country where the event takes place"),
  location: PointSchema.nullable()
    .default(null)
    .describe("Geographic coordinates of the event"),
});

export const EventInputSchema = EventSchema.omit({ id: true }).extend({
  country: z
    .number()
    .nullable()
    .default(null)
    .describe("ID of the country where the event takes place"),
});
