export default {
  $id: "entitySchema",
  type: "object",
  properties: {
    name: { type: "string" },
    type: {
      type: "array",
      items: {
        type: "string",
        enum: ["brand", "distiller", "bottler"],
      },
    },
    country: { type: "string" },
    region: { type: "string" },
  },
};
