import { buildPageLink } from "./paging";

test("without params", async () => {
  expect(buildPageLink("/bottles", {}, 1)).toBe(
    "http://localhost:4000/bottles?page=1",
  );
});

test("without page param", async () => {
  expect(buildPageLink("/bottles", { foo: "bar" }, 1)).toBe(
    "http://localhost:4000/bottles?foo=bar&page=1",
  );
});

test("with page param only", async () => {
  expect(buildPageLink("/bottles", { page: 8 }, 1)).toBe(
    "http://localhost:4000/bottles?page=1",
  );
});

test("with page param", async () => {
  expect(buildPageLink("/bottles", { foo: "bar", page: 8 }, 1)).toBe(
    "http://localhost:4000/bottles?foo=bar&page=1",
  );
});
