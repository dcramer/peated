import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { AuthenticationIntro } from "./authentication.stylex";

test("marks the sign-in facts as busy while they load", () => {
  const html = renderToStaticMarkup(
    <AuthenticationIntro loading title="Welcome" />,
  );

  expect(html).toContain('aria-busy="true"');
});
