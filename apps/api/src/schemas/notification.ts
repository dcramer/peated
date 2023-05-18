export const notificationSchema = {
  $id: "/schemas/notification",
  type: "object",
  required: ["id", "objectId", "objectType", "fromUser", "createdAt", "ref"],
  properties: {
    id: { type: "string" },
    objectType: { type: "string", enum: ["follow", "toast", "comment"] },
    objectId: { type: "string" },
    createdAt: { type: "string" },
    fromUser: { $ref: "/schemas/user" },
    ref: {
      anyOf: [
        { $ref: "/schemas/follow" },
        { $ref: "/schemas/tasting" },
        { type: "null" },
      ],
    },
  },
};
