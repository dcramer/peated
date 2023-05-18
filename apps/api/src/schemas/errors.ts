export const error401Schema = {
  $id: "/errors/401",
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
    name: { type: "string" },
  },
};
