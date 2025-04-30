import { defaultFormula, fibonacciFormula, linearFormula } from "./formula";

describe("defaultFormula", () => {
  test("basic tests", () => {
    expect(defaultFormula(1, 50)).toMatchInlineSnapshot(`0`);
    expect(defaultFormula(5, 50)).toMatchInlineSnapshot(`1`);
    expect(defaultFormula(10, 50)).toMatchInlineSnapshot(`2`);
    expect(defaultFormula(15, 50)).toMatchInlineSnapshot(`2`);
    expect(defaultFormula(20, 50)).toMatchInlineSnapshot(`3`);
    expect(defaultFormula(25, 50)).toMatchInlineSnapshot(`4`);
    expect(defaultFormula(30, 50)).toMatchInlineSnapshot(`5`);
    expect(defaultFormula(35, 50)).toMatchInlineSnapshot(`5`);
    expect(defaultFormula(40, 50)).toMatchInlineSnapshot(`6`);
    expect(defaultFormula(45, 50)).toMatchInlineSnapshot(`7`);
    expect(defaultFormula(50, 50)).toMatchInlineSnapshot(`7`);
    expect(defaultFormula(75, 50)).toMatchInlineSnapshot(`9`);
    expect(defaultFormula(100, 50)).toMatchInlineSnapshot(`12`);
    expect(defaultFormula(150, 50)).toMatchInlineSnapshot(`15`);
    expect(defaultFormula(250, 50)).toMatchInlineSnapshot(`20`);
    expect(defaultFormula(500, 50)).toMatchInlineSnapshot(`28`);
    expect(defaultFormula(1000, 50)).toMatchInlineSnapshot(`39`);
  });
});

describe("linearFormula", () => {
  test("basic tests", () => {
    expect(linearFormula(1, 50)).toMatchInlineSnapshot(`0`);
    expect(linearFormula(5, 50)).toMatchInlineSnapshot(`1`);
    expect(linearFormula(10, 50)).toMatchInlineSnapshot(`2`);
    expect(linearFormula(15, 50)).toMatchInlineSnapshot(`3`);
    expect(linearFormula(20, 50)).toMatchInlineSnapshot(`4`);
    expect(linearFormula(25, 50)).toMatchInlineSnapshot(`5`);
    expect(linearFormula(30, 50)).toMatchInlineSnapshot(`6`);
    expect(linearFormula(35, 50)).toMatchInlineSnapshot(`7`);
    expect(linearFormula(40, 50)).toMatchInlineSnapshot(`8`);
    expect(linearFormula(45, 50)).toMatchInlineSnapshot(`9`);
    expect(linearFormula(50, 50)).toMatchInlineSnapshot(`10`);
    expect(linearFormula(75, 50)).toMatchInlineSnapshot(`15`);
    expect(linearFormula(100, 50)).toMatchInlineSnapshot(`20`);
    expect(linearFormula(150, 50)).toMatchInlineSnapshot(`30`);
    expect(linearFormula(250, 50)).toMatchInlineSnapshot(`50`);
    expect(linearFormula(500, 50)).toMatchInlineSnapshot(`50`);
    expect(linearFormula(1000, 50)).toMatchInlineSnapshot(`50`);
  });
});

describe("fibonacciFormula", () => {
  test("basic tests", () => {
    expect(fibonacciFormula(1, 5)).toMatchInlineSnapshot(`1`);
    expect(fibonacciFormula(2, 5)).toMatchInlineSnapshot(`2`);
    expect(fibonacciFormula(3, 5)).toMatchInlineSnapshot(`2`);
    expect(fibonacciFormula(4, 5)).toMatchInlineSnapshot(`3`);
    expect(fibonacciFormula(5, 5)).toMatchInlineSnapshot(`3`);
    expect(fibonacciFormula(10, 5)).toMatchInlineSnapshot(`4`);
    expect(fibonacciFormula(15, 5)).toMatchInlineSnapshot(`5`);
    expect(fibonacciFormula(20, 5)).toMatchInlineSnapshot(`5`);
    expect(fibonacciFormula(25, 5)).toMatchInlineSnapshot(`5`);
  });
});
