export default {
  $id: "/schemas/paging",
  type: "object",
  properties: {
    next: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    nextPage: {
      anyOf: [{ type: "number" }, { type: "null" }],
    },
    prev: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    prevPage: {
      anyOf: [{ type: "number" }, { type: "null" }],
    },
  },
};
