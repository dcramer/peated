export const userSchema = {
  $id: "/schemas/user",
  type: "object",
  required: ["id", "displayName", "username", "pictureUrl"],
  properties: {
    id: { type: "string" },
    displayName: { type: "string" },
    email: { type: "string", format: "email" },
    username: { type: "string" },
    admin: { type: "boolean" },
    mod: { type: "boolean" },
    createdAt: { type: "string" },
    pictureUrl: { type: "string" },
    followStatus: {
      type: "string",
      enum: ["pending", "following", "none"],
    },
  },
};

export const updateUserSchema = {
  $id: "/schemas/updateUser",
  type: "object",
  properties: {
    displayName: { type: "string" },
    username: { type: "string" },
    admin: { type: "boolean" },
    mod: { type: "boolean" },
  },
};
