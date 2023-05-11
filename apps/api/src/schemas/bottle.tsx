export default {
  $id: "bottleSchema",
  type: "object",
  properties: {
    name: { type: "string" },
    brand: {
      oneOf: [
        { type: "number" },
        {
          type: "object",
          required: ["name", "country"],
          properties: {
            id: {
              type: "number",
            },
            name: {
              type: "string",
            },
            country: {
              type: "string",
            },
            region: {
              type: "string",
            },
          },
        },
      ],
    },
    distillers: {
      type: "array",
      items: {
        oneOf: [
          { type: "number" },
          {
            type: "object",
            required: ["name", "country"],
            properties: {
              id: {
                type: "number",
              },
              name: {
                type: "string",
              },
              country: {
                type: "string",
              },
              region: {
                type: "string",
              },
            },
          },
        ],
      },
    },
    category: {
      type: "string",
      enum: [
        "",
        "blend",
        "bourbon",
        "rye",
        "single_grain",
        "single_malt",
        "spirit",
      ],
    },
    statedAge: { type: "number" },
  },
};
