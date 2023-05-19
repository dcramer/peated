export const commentSchema = {
  $id: "/schemas/comment",
  type: "object",
  required: ["id", "comment", "createdBy", "createdAt"],
  properties: {
    id: { type: "number" },
    comment: { type: "string" },
    createdBy: { $ref: "/schemas/user" },
    createdAt: { type: "string" },
  },
};

export const newCommentSchema = {
  $id: "/schemas/newComment",
  type: "object",
  required: ["comment", "createdAt"],
  properties: {
    comment: { type: "string" },
    createdAt: { type: "string" },
  },
};
