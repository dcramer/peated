export const followingSchema = {
  $id: "/schemas/follow",
  type: "object",
  required: ["id", "status", "createdAt", "user", "followsBack"],
  properties: {
    id: { type: "number" },
    status: {
      type: "string",
      enum: ["pending", "following", "none"],
    },
    createdAt: { type: "string" },
    user: { $ref: "/schemas/user" },
    followsBack: {
      type: "string",
      enum: ["pending", "following", "none"],
    },
  },
};
