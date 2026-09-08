import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BotPage from "./page";

describe("PeatedBot page", () => {
  it("publishes the information needed to identify and verify requests", () => {
    const html = renderToStaticMarkup(<BotPage />);

    expect(html).toContain("PeatedBot/1.0 (+https://peated.com/bot)");
    expect(html).toContain(
      'href="https://peated.com/.well-known/http-message-signatures-directory"',
    );
    expect(html).toContain("Ed25519");
    expect(html).toContain("It never includes the private key.");
  });
});
