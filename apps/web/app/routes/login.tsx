import { useGoogleLogin } from "@react-oauth/google";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { type SitemapFunction } from "remix-sitemap";
import Alert from "~/components/alert";
import PeatedLogo from "~/components/assets/Logo";
import Button from "~/components/button";
import Layout from "~/components/layout";
import TextField from "~/components/textField";
import config from "~/config";
import { authenticator } from "~/services/auth.server";
import { createSession } from "~/services/session.server";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function action({ request, context }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");

  try {
    const session = await authenticator.authenticate("default", request, {
      context,
    });

    if (!session) {
      return json({ error: "Invalid credentials" });
    }

    return await createSession({
      request,
      session,
      redirectTo,
    });
  } catch (err) {
    return json({ error: "Invalid credentials" });
  }
}

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");
  return json({ redirectTo });
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Login",
    },
  ];
};

const BasicLogin = () => {
  return (
    <Form method="post">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="mb-2 rounded"
      />
      <TextField
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="password"
        className="mb-2 rounded"
      />
      <div className="flex justify-center">
        <Button type="submit" color="highlight" fullWidth>
          Sign in
        </Button>
      </div>
    </Form>
  );
};

const GoogleLogin = () => {
  const submit = useSubmit();

  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      const data = new FormData();
      data.append("code", codeResponse.code);
      submit(data, { method: "POST" });
      setLoading(false);
    },
    onError: () => {
      console.log("Login Failed");
      setLoading(false);
    },
  });

  return (
    <div>
      <Button
        fullWidth
        color="highlight"
        onClick={() => {
          setLoading(true);
          googleLogin();
        }}
        disabled={loading}
      >
        <svg
          className="-ml-1 mr-2 h-4 w-4"
          aria-hidden="true"
          focusable="false"
          data-prefix="fab"
          data-icon="google"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 488 512"
        >
          <path
            fill="currentColor"
            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
          ></path>
        </svg>
        Sign in with Google
      </Button>
    </div>
  );
};

export default function Login() {
  const { error } = useActionData<typeof action>() || { error: null };

  return (
    <Layout splash>
      <div className="flex flex-grow items-center justify-center px-4">
        <Link to="/" className="max-w-xs">
          <PeatedLogo className="text-highlight h-auto w-full" />
        </Link>
      </div>

      <div className="min-w-sm mt-8 flex-auto">
        {error ? <Alert>{error}</Alert> : null}
        {config.GOOGLE_CLIENT_ID && (
          <>
            <GoogleLogin />
            <div className="relative my-4 text-slate-700">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="min-w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-950 px-2 text-sm">Or</span>
              </div>
            </div>
          </>
        )}
        <BasicLogin />
      </div>
      <div className="mt-6 text-center text-xs">
        <Link to="/about" className="text-highlight underline">
          About Peated
        </Link>
      </div>
    </Layout>
  );
}
