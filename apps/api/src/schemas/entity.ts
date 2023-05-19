export const entitySchema = {
  $id: "/schemas/entity",
  type: "object",
  required: [
    "id",
    "name",
    "type",
    "country",
    "region",
    "totalTastings",
    "totalBottles",
  ],
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    type: {
      $ref: "#/$defs/type",
    },
    country: { type: "string", nullable: true },
    region: { type: "string", nullable: true },

    totalTastings: { type: "number" },
    totalBottles: { type: "number" },

    createdAt: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
  },

  $defs: {
    type: {
      type: "array",
      items: {
        type: "string",
        enum: ["brand", "distiller", "bottler"],
      },
    },
  },
};

export const newEntitySchema = {
  $id: "/schemas/newEntity",
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" },
    type: {
      $ref: "/schemas/entity#/$defs/type",
    },
    country: { type: "string", nullable: true },
    region: { type: "string", nullable: true },
  },
};

export const updateEntitySchema = {
  $id: "/schemas/updateEntity",
  type: "object",
  properties: {
    name: { type: "string" },
    type: {
      $ref: "/schemas/entity#/$defs/type",
    },
    country: { type: "string", nullable: true },
    region: { type: "string", nullable: true },
  },
};
