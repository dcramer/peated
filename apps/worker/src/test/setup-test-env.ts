import mockAxios from "vitest-mock-axios";

vi.mock("axios");
vi.mock("@peated/server/jobs");

afterEach(() => {
  mockAxios.reset();
});
