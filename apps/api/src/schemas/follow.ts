export const followingSchema = {
  $id: "/schemas/follow",
  type: "object",
  required: ["id", "status", "createdAt", "user", "followsBack"],
  properties: {
    id: { type: "string" },
    status: { $ref: "#/$defs/status" },
    createdAt: { type: "string" },
    user: { $ref: "/schemas/user" },
    followsBack: { $ref: "#/$defs/status" },
  },

  $defs: {
    status: {
      type: "string",
      enum: ["pending", "following", "none"],
    },
  },
};
