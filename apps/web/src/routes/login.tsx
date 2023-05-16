import { useGoogleLogin } from "@react-oauth/google";
import { FormEvent, useState } from "react";
import { LoaderFunction, useNavigate } from "react-router-dom";
import Layout from "../components/layout";
import useAuth from "../hooks/useAuth";
import api, { ApiError } from "../lib/api";

import { ReactComponent as PeatedLogo } from "../assets/logo.svg";
import Alert from "../components/alert";
import Button from "../components/button";
import TextField from "../components/textField";
import config from "../config";

type LoaderData = Record<string, never>;

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  return {};
};

type BasicLoginForm = {
  email?: string;
  password?: string;
};

const BasicLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<BasicLoginForm>({});
  const [error, setError] = useState<string | null>();
  const [loading, setLoading] = useState<boolean>(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    (async () => {
      try {
        const { user, accessToken } = await api.post("/auth/basic", {
          data,
        });
        login(user, accessToken);
        navigate("/");
      } catch (err) {
        setLoading(false);
        if (err instanceof ApiError) {
          if (err.statusCode === 401) {
            setError("Your login credentials didn't pass the test.");
          }
        } else {
          throw err;
        }
      }
    })();
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-2">{error && <Alert>{error}</Alert>}</div>
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        onChange={(e) => setData({ ...data, [e.target.name]: e.target.value })}
        className="mb-2 rounded"
      />
      <TextField
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="password"
        onChange={(e) => setData({ ...data, [e.target.name]: e.target.value })}
        className="mb-2 rounded"
      />
      <div className="flex justify-center">
        <Button type="submit" disabled={loading} color="primary" fullWidth>
          Sign in
        </Button>
      </div>
    </form>
  );
};

const GoogleLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState("");

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      try {
        const { user, accessToken } = await api.post("/auth/google", {
          data: {
            code: codeResponse.code,
          },
        });
        login(user, accessToken);
        navigate("/");
      } catch (err) {
        setError("There was an error communicating with the server.");
      }
    },
    onError: () => {
      console.log("Login Failed");
    },
  });

  return (
    <div className="mx-auto max-w-sm">
      {error && <Alert>{error}</Alert>}
      <Button fullWidth color="primary" onClick={() => googleLogin()}>
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
  return (
    <Layout noHeader splash>
      <PeatedLogo className="h-auto max-w-full text-white" />

      <div className="mt-8">
        {config.GOOGLE_CLIENT_ID && (
          <>
            <GoogleLogin />
            <div className="relative mb-2 mt-4 text-slate-700">
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
    </Layout>
  );
}
