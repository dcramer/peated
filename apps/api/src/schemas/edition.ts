export const editionSchema = {
  $id: "/schemas/edition",
  type: "object",
  required: ["id", "name", "barrel", "vintageYear"],
  properties: {
    id: { type: "number" },
    name: { type: "string", nullable: true },
    barrel: { type: "number", nullable: true },
    vintageYear: { type: "number", nullable: true },
    createdAt: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
  },
};

export const newEditionSchema = {
  $id: "/schemas/newEdition",
  type: "object",
  properties: {
    name: { type: "string", nullable: true },
    barrel: { type: "number", nullable: true },
    vintageYear: { type: "number", nullable: true },
  },
};
