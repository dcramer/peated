import { formatPeatedId, isCanonicalPeatedId, parsePeatedId } from "./peatedId";

describe("Peated IDs", () => {
  test("formats bottle and entity IDs", () => {
    expect(formatPeatedId("bottle", 123)).toBe("B0123");
    expect(formatPeatedId("entity", 123)).toBe("E0123");
    expect(formatPeatedId("bottle", 1234567)).toBe("B1234567");
  });

  test("parses IDs case-insensitively", () => {
    expect(parsePeatedId("b123")).toEqual({
      type: "bottle",
      id: 123,
      peatedId: "B0123",
    });
    expect(parsePeatedId(" E456 ")).toEqual({
      type: "entity",
      id: 456,
      peatedId: "E0456",
    });
  });

  test("recognizes only canonical output", () => {
    expect(isCanonicalPeatedId("B0123", "bottle")).toBe(true);
    expect(isCanonicalPeatedId("B123", "bottle")).toBe(false);
    expect(isCanonicalPeatedId("B000123", "bottle")).toBe(false);
    expect(isCanonicalPeatedId("b0123", "bottle")).toBe(false);
  });

  test.each(["", "B0", "B0000", "B-1", "B1.5", "X123", "BB123", "123"])(
    "rejects invalid value %j",
    (value) => {
      expect(parsePeatedId(value)).toBeNull();
    },
  );

  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid numeric ID %s",
    (id) => {
      expect(() => formatPeatedId("bottle", id)).toThrow(RangeError);
    },
  );
});
