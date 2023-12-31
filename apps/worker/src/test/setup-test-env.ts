// make sure to import this _before_ all other code
import "../sentry";

import mockAxios from "vitest-mock-axios";

vi.mock("axios");
vi.mock("@peated/server/jobs");

afterEach(() => {
  mockAxios.reset();
});
