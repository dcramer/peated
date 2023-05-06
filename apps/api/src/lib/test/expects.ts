import { expect } from "vitest";

expect.extend({
  toRespondWith: function (response, statusCode: number) {
    if (!this.equals(response.statusCode, statusCode)) {
      return {
        message: () => this.utils.stringify(response.payload),
        pass: false,
        expected: statusCode,
        actual: response.statusCode,
      };
    }
    return {
      pass: true,
      message: () => "",
    };
  },
});
