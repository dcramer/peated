import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { AgeCheck } from "./ageCheck";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
      maxAge: 10,
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(
      `
      {
        "maxAge": 10,
        "minAge": 5,
      }
    `,
    );
  });

  test("minAge < 0", async () => {
    const badgeImpl = new AgeCheck();
    const config = {
      minAge: -1,
      maxAge: 10,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "origin": "number",
          "code": "too_small",
          "minimum": 0,
          "inclusive": true,
          "path": [
            "minAge"
          ],
          "message": "Too small: expected number to be >=0"
        }
      ]]
    `);
  });

  test("no minAge", async () => {
    const badgeImpl = new AgeCheck();
    const config = {
      maxAge: 10,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "expected": "number",
          "code": "invalid_type",
          "path": [
            "minAge"
          ],
          "message": "Invalid input: expected number, received undefined"
        }
      ]]
    `);
  });

  test("maxAge < 0", async () => {
    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
      maxAge: -1,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "origin": "number",
          "code": "too_small",
          "minimum": 0,
          "inclusive": true,
          "path": [
            "maxAge"
          ],
          "message": "Too small: expected number to be >=0"
        }
      ]]
    `);
  });

  test("no maxAge", async () => {
    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "expected": "number",
          "code": "invalid_type",
          "path": [
            "maxAge"
          ],
          "message": "Invalid input: expected number, received undefined"
        }
      ]]
    `);
  });
});

describe("test", () => {
  test("within age range, inclusive, minimum", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 5 });

    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
      maxAge: 10,
    };
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("within age range, inclusive, maximum", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 10 });

    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
      maxAge: 10,
    };
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("outside of age range", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 4 });

    const badgeImpl = new AgeCheck();
    const config = {
      minAge: 5,
      maxAge: 10,
    };
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
