import { FormEvent, useState } from "react";
import { Form, LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";

import PeatedLogo from "../assets/logo.svg";
import TextInput from "../components/textInput";
import FormField from "../components/formField";

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
      <Form onSubmit={onSubmit}>
        <div className="relative mt-4 mb-2">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-peated-light" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-peated px-2 text-sm text-white">Or</span>
          </div>
        </div>
        <FormField>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            onChange={(e) =>
              setData({ ...data, [e.target.name]: e.target.value })
            }
          />
        </FormField>
        <FormField>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="password"
            onChange={(e) =>
              setData({ ...data, [e.target.name]: e.target.value })
            }
          />
        </FormField>
        <div>
          <button
            type="submit"
            className="flex w-full justify-center rounded-md bg-peated-dark px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated"
          >
            Sign in
          </button>
        </div>{" "}
      </Form>
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
