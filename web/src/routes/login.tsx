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
        <h2 className="text-center mt-4 mb-2">OR</h2>
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
            className="flex w-full justify-center rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
  const [loginVisible, setLoginVisible] = useState(false);

  return (
    <Layout noHeader splash>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <PeatedLogo />
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
          {!loginVisible ? (
            <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-sm text-center text-xs text-gray-500">
              <button
                className="font-semibold leading-6 text-white"
                onClick={() => {
                  setLoginVisible(true);
                }}
              >
                Sign in with email and password
              </button>
            </div>
          ) : (
            <BasicLogin />
          )}
        </div>
      </div>
    </Layout>
  );
}
