import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SearchHeaderForm from "./searchHeaderForm";
import TextInput from "./textInput";

describe("search input hints", () => {
  it("disables spelling assistance in search headers", () => {
    const html = renderToStaticMarkup(<SearchHeaderForm />);

    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellCheck="false"');
  });

  it("disables spelling assistance on shared search inputs", () => {
    const html = renderToStaticMarkup(<TextInput type="search" />);

    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellCheck="false"');
  });
});
