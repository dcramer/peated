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
        (reason: unknown) => reason,
      );

    expect(uniqueViolationConstraint(error)).toBe("tag_pkey");
    // Sensitive data policy: patches/drizzle-orm@*.patch keeps parameter
    // values out of failed-query messages and stacks.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(tag.name);
    expect((error as Error).stack).not.toContain(tag.name);
  });

  test("returns null for other errors", () => {
    expect(uniqueViolationConstraint(new Error("boom"))).toBeNull();
    expect(uniqueViolationConstraint("23505")).toBeNull();
  });
});
