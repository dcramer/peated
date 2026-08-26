import { implement } from "@orpc/server";
import type { MockContext } from "./context";
import { mockContract } from "./contract";

export const mockOS = implement(mockContract).$context<MockContext>();
