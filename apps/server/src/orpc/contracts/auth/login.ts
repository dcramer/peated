import { AuthSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const TosAcceptedSchema = z
  .boolean()
  .optional()
  .describe("Whether the user accepted the Terms of Service");

export default contract
  .route({
    method: "POST",
    path: "/auth/login",
    summary: "User login",
    description:
      "Sign in with email and password, a Google OAuth code, a Google ID token, or an Apple identity token",
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
          tosAccepted: TosAcceptedSchema,
        })
        .describe("Google OAuth (code)"),
      z
        .object({
          idToken: z.string().describe("Google idToken"),
          tosAccepted: TosAcceptedSchema,
        })
        .describe("Google OAuth (idToken)"),
      z
        .object({
          appleIdentityToken: z
            .string()
            .describe(
              "Identity token (JWT) from Sign in with Apple. Its audience must be the app's bundle ID.",
            ),
          fullName: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe(
              "The user's name as Apple sends it on the first sign-in. Used to pick a username for a new account.",
            ),
          tosAccepted: TosAcceptedSchema,
        })
        .describe("Sign in with Apple (identity token)"),
    ]),
  )
  .output(AuthSchema);
