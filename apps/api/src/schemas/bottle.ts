export const bottleSchema = {
  $id: "/schemas/bottle",
  type: "object",
  required: ["id", "name", "brand", "distillers", "category", "statedAge"],
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    brand: {
      $ref: "/schemas/entity",
    },
    distillers: {
      type: "array",
      items: {
        $ref: "/schemas/entity",
      },
    },
    category: {
      type: "string",
      nullable: true,
      enum: [
        null,
        "blend",
        "bourbon",
        "rye",
        "single_grain",
        "single_malt",
        "spirit",
      ],
    },
    statedAge: {
      type: "number",
      nullable: true,
    },

    createdAt: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
  },
};

export const newBottleSchema = {
  $id: "/schemas/newBottle",
  type: "object",
  required: ["name", "brand"],
  properties: {
    name: { type: "string" },
    brand: {
      oneOf: [
        { type: "number" },
        {
          $ref: "/schemas/newEntity",
        },
      ],
    },
    distillers: {
      type: "array",
      items: {
        oneOf: [
          { type: "number" },
          {
            $ref: "/schemas/newEntity",
          },
        ],
      },
    },
    category: {
      type: "string",
      nullable: true,
      enum: [
        null,
        "",
        "blend",
        "bourbon",
        "rye",
        "single_grain",
        "single_malt",
        "spirit",
      ],
    },
    statedAge: {
      type: "number",
      nullable: true,
    },
  },
};

export const updateBottleSchema = {
  $id: "/schemas/updateBottle",
  type: "object",
  properties: {
    name: { type: "string" },
    brand: {
      oneOf: [
        { type: "number" },
        {
          $ref: "/schemas/newEntity",
        },
      ],
    },
    distillers: {
      type: "array",
      items: {
        oneOf: [
          { type: "number" },
          {
            $ref: "/schemas/newEntity",
          },
        ],
      },
    },
    category: {
      type: "string",
      nullable: true,
      enum: [
        null,
        "",
        "blend",
        "bourbon",
        "rye",
        "single_grain",
        "single_malt",
        "spirit",
      ],
    },
    statedAge: {
      type: "number",
      nullable: true,
    },
  },
};
