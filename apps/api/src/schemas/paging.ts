export default {
  $id: "/schemas/paging",
  type: "object",
  properties: {
    next: { type: "string", nullable: true },
    nextPage: { type: "string", nullable: true },
    prev: { type: "string", nullable: true },
    prevPage: { type: "string", nullable: true },
  },
};
