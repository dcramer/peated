import { AuthSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "POST",
    path: "/auth/login",
    summary: "User login",
    description:
      "Authenticate user with email/password, Google OAuth code, or Google ID token",
    spec: (spec) => ({
      ...spec,
      operationId: "login",
    }),
  })
  .input(
    z.union([
      z
        .object({
          email: z
            .string()
            .email()
            .toLowerCase()
            .describe("User email address"),
          password: z.string().describe("User password"),
        })
        .describe("Basic authentication"),
      z
        .object({
          code: z.string().describe("Google OAuth authorization code"),
          tosAccepted: z
            .boolean()
            .optional()
            .describe("User accepted Terms of Service"),
        })
        .describe("Google OAuth (code)"),
      z
        .object({
          idToken: z.string().describe("Google idToken"),
          tosAccepted: z
            .boolean()
            .optional()
            .describe("User accepted Terms of Service"),
        })
        .describe("Google OAuth (idToken)"),
    ]),
  )
  .output(AuthSchema);
