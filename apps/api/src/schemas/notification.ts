export const notificationSchema = {
  $id: "/schemas/notification",
  type: "object",
  required: ["id", "objectId", "objectType", "fromUser", "createdAt", "ref"],
  // XXX: ref isnt working right
  additionalProperties: true,
  properties: {
    id: { type: "number" },
    objectType: { type: "string", enum: ["follow", "toast", "comment"] },
    objectId: { type: "number" },
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
