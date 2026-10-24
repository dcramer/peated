import { uniqueViolationConstraint } from "./errors";
import { db } from "./index";
import { tags } from "./schema";

describe("uniqueViolationConstraint", () => {
  test("names the violated constraint without exposing query values", async ({
    fixtures,
  }) => {
    const tag = await fixtures.Tag({ name: "private-tag-value" });

    const error = await db
      .insert(tags)
      .values({ name: tag.name, tagCategory: tag.tagCategory })
      .then(
        () => null,
        (reason: Error) => reason,
      );
    if (!error) throw new Error("Expected the duplicate insert to fail.");

    expect(uniqueViolationConstraint(error)).toBe("tag_pkey");
    // Sensitive data policy: patches/drizzle-orm@*.patch keeps parameter
    // values out of failed-query messages and stacks.
    expect(error.message).not.toContain(tag.name);
    expect(error.stack).not.toContain(tag.name);
  });

  test("returns null for other errors", () => {
    expect(uniqueViolationConstraint(new Error("boom"))).toBeNull();
  });
});
