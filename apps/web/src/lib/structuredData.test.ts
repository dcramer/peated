import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "./structuredData";

describe("serializeJsonLd", () => {
  it("keeps structured data valid while escaping script-closing text", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "Thing",
      name: '</script><script>alert("unsafe")</script>',
    };
    const serialized = serializeJsonLd(value);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
