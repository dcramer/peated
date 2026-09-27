import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * One image label reading per image and extractor version. Each upload gets a
 * new file name, so a URL always shows the same image, and the Bottle
 * classifier reuses the reading instead of asking the model again every time
 * the same candidate image is inspected.
 */
export const imageLabelExtractions = pgTable(
  "image_label_extraction",
  {
    imageUrl: text("image_url").notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    // Null when the model could not read Bottle facts from the image.
    extractedIdentity: jsonb("extracted_identity"),
    rawLabelText: text("raw_label_text"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.imageUrl, table.version] })],
);

export type ImageLabelExtraction = typeof imageLabelExtractions.$inferSelect;
