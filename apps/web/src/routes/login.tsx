import { FormEvent, useState } from "react";
import { LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api, { ApiError } from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";

import { ReactComponent as PeatedLogo } from "../assets/logo.svg";
import TextField from "../components/textField";
import classNames from "../lib/classNames";
import Alert from "../components/alert";

type LoaderData = {};

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
            setError("Your login credentials didn't pass the test");
          }
        } else {
          throw err;
        }
      }
    })();
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="relative mt-4 mb-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="min-w-full border-t border-peated-light" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-peated px-2 text-sm text-white">Or</span>
        </div>
      </div>
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
      <div>
        <button
          type="submit"
          className={classNames(
            "flex w-full justify-center rounded bg-peated-dark px-3 py-1.5 text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated",
            loading ? "text-peated-light" : "text-white"
          )}
          disabled={loading}
        >
          Sign in
        </button>
      </div>
    </form>
  );
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout noHeader splash>
      <PeatedLogo color="white" />

      <div className="mt-8">
        <div className="max-w-sm mx-auto">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              const { user, accessToken } = await api.post("/auth/google", {
                data: {
                  token: credentialResponse.credential,
                },
              });
              login(user, accessToken);
              navigate("/");
            }}
            onError={() => {
              console.log("Login Failed");
            }}
          />
        </div>
        <BasicLogin />
      </div>
    </Layout>
  );
}
