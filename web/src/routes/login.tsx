import { FormEvent, useState } from "react";
import { LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";

import PeatedLogo from "../assets/logo.svg";
import TextField from "../components/textField";

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

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    (async () => {
      const { user, accessToken } = await api.post("/auth/basic", {
        data,
      });
      login(user, accessToken);
      navigate("/");
    })();
  };

  return (
    <div className="sm:mx-auto sm:w-full sm:max-w-sm">
      <form onSubmit={onSubmit}>
        <div className="relative mt-4 mb-2">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="min-w-full border-t border-peated-light" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-peated px-2 text-sm text-white">Or</span>
          </div>
        </div>
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          onChange={(e) =>
            setData({ ...data, [e.target.name]: e.target.value })
          }
          className="mb-2 rounded"
        />
        <TextField
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="password"
          onChange={(e) =>
            setData({ ...data, [e.target.name]: e.target.value })
          }
          className="mb-2 rounded"
        />
        <div>
          <button
            type="submit"
            className="flex w-full justify-center rounded bg-peated-dark px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated"
          >
            Sign in
          </button>
        </div>{" "}
      </form>
    </div>
  );
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout noHeader splash>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <PeatedLogo color="white" />
        </div>

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
      </div>
    </Layout>
  );
}
