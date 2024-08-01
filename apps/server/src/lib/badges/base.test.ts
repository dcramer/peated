import { defaultCalculateLevel } from "./base";

describe("defaultCalculateLevel", () => {
  test("basic tests", () => {
    expect(defaultCalculateLevel(1, 50)).toMatchInlineSnapshot(`1`);
    expect(defaultCalculateLevel(5, 50)).toMatchInlineSnapshot(`2`);
    expect(defaultCalculateLevel(10, 50)).toMatchInlineSnapshot(`3`);
    expect(defaultCalculateLevel(15, 50)).toMatchInlineSnapshot(`3`);
    expect(defaultCalculateLevel(20, 50)).toMatchInlineSnapshot(`4`);
    expect(defaultCalculateLevel(25, 50)).toMatchInlineSnapshot(`5`);
    expect(defaultCalculateLevel(30, 50)).toMatchInlineSnapshot(`6`);
    expect(defaultCalculateLevel(35, 50)).toMatchInlineSnapshot(`6`);
    expect(defaultCalculateLevel(40, 50)).toMatchInlineSnapshot(`7`);
    expect(defaultCalculateLevel(45, 50)).toMatchInlineSnapshot(`8`);
    expect(defaultCalculateLevel(50, 50)).toMatchInlineSnapshot(`8`);
    expect(defaultCalculateLevel(75, 50)).toMatchInlineSnapshot(`10`);
    expect(defaultCalculateLevel(100, 50)).toMatchInlineSnapshot(`13`);
    expect(defaultCalculateLevel(150, 50)).toMatchInlineSnapshot(`16`);
    expect(defaultCalculateLevel(250, 50)).toMatchInlineSnapshot(`21`);
    expect(defaultCalculateLevel(500, 50)).toMatchInlineSnapshot(`29`);
    expect(defaultCalculateLevel(1000, 50)).toMatchInlineSnapshot(`40`);
  });
});
