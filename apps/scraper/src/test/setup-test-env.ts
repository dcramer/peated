import mockAxios from "vitest-mock-axios";

vi.mock("axios");

afterEach(() => {
  mockAxios.reset();
});
