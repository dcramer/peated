import { AuthSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "POST",
    path: "/auth/login",
    summary: "User login",
    description:
      "Sign in with email and password, a Google OAuth code, or a Google ID token",
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
        .describe("Email and password"),
      z
        .object({
          code: z.string().describe("Google OAuth authorization code"),
          tosAccepted: z
            .boolean()
            .optional()
            .describe("Whether the user accepted the Terms of Service"),
        })
        .describe("Google OAuth (code)"),
      z
        .object({
          idToken: z.string().describe("Google idToken"),
          tosAccepted: z
            .boolean()
            .optional()
            .describe("Whether the user accepted the Terms of Service"),
        })
        .describe("Google OAuth (idToken)"),
    ]),
  )
  .output(AuthSchema);
