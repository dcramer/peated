import { Grid, Typography } from "@mui/material";
import { LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";
import config from "../config";
import { FormEvent, useState } from "react";

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
    <form onSubmit={onSubmit}>
      <h2>Debug Login</h2>
      <input
        name="email"
        placeholder="email"
        required
        onChange={(e) => setData({ ...data, email: e.target.value })}
      />
      <input
        name="password"
        type="password"
        placeholder="password"
        required
        onChange={(e) => setData({ ...data, password: e.target.value })}
      />
      <input type="submit" style={{ display: "none" }} />
    </form>
  );
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ minHeight: "100vh" }}
      >
        <Grid item xs={3}>
          <Typography variant="h1">Cask</Typography>
        </Grid>
        <Grid item xs={3}>
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
          {config.DEBUG && <BasicLogin />}
        </Grid>
      </Grid>
    </Layout>
  );
}
