export const newTastingSchema = {
  $id: "/schemas/newTasting",
  type: "object",
  required: ["bottle", "rating"],
  properties: {
    bottle: { type: "number" },
    rating: { type: "number", minimum: 0, maximum: 5 },
    notes: { type: "string", nullable: true },
    tags: { type: "array", items: { type: "string" } },
    edition: { type: "string", nullable: true },
    vintageYear: { type: "number", nullable: true },
    barrel: { type: "number", nullable: true },
  },
};

export const tastingSchema = {
  $id: "/schemas/tasting",
  type: "object",
  required: [
    "id",
    "imageUrl",
    "notes",
    "tags",
    "rating",
    "createdAt",
    "comments",
    "toasts",
    "bottle",
    "createdBy",
  ],
  properties: {
    id: { type: "string" },
    imageUrl: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    bottle: { $ref: "/schemas/bottle" },
    rating: { type: "number", minimum: 0, maximum: 5 },
    tags: { type: "array", items: { type: "string" } },

    comments: { type: "number" },
    toasts: { type: "number" },
    hasToasted: { type: "boolean" },
    edition: {
      anyOf: [{ $ref: "/schemas/edition" }, { type: "null" }],
    },
    createdAt: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
  },
};
