export const collectionSchema = {
  $id: "/schemas/collection",
  type: "object",
  required: ["id", "name", "createdAt"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
    createdAt: { type: "string" },
  },
};
