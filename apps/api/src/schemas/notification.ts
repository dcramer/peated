export const notificationSchema = {
  $id: "/schemas/notification",
  type: "object",
  required: ["id", "objectId", "objectType", "fromUser", "createdAt", "ref"],
  // XXX: ref isnt working right
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    objectType: { type: "string", enum: ["follow", "toast", "comment"] },
    objectId: { type: "string" },
    createdAt: { type: "string" },
    fromUser: { $ref: "/schemas/user" },
    // ref: {
    //   anyOf: [
    //     { type: "null" },
    //     { $ref: "/schemas/tasting" },
    //     { $ref: "/schemas/follow" },
    //   ],
    // },
  },
};
