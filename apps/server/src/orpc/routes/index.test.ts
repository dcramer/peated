import {
  isProcedure,
  isStartWithMiddlewares,
  traverseContractProcedures,
} from "@orpc/server";
import { api } from "@peated/server/orpc";
import router from "./index";

describe("API router", () => {
  it("applies global middleware to every route", () => {
    const globalMiddleware = api["~orpc"].middlewares;
    let procedureCount = 0;

    expect(globalMiddleware.length).toBeGreaterThan(0);

    traverseContractProcedures({ router, path: [] }, ({ contract, path }) => {
      const routeName = path.join(".");

      expect(isProcedure(contract), routeName).toBe(true);
      if (!isProcedure(contract)) return;

      procedureCount += 1;
      expect(
        isStartWithMiddlewares(contract["~orpc"].middlewares, globalMiddleware),
        routeName,
      ).toBe(true);
    });

    expect(procedureCount).toBeGreaterThan(0);
  });
});
