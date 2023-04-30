import { Box, Button, Grid, TextField, Typography } from "@mui/material";
import { LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";
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

  const [loginVisible, setLoginVisible] = useState(false);

  if (!loginVisible) {
    return (
      <Grid justifyContent="center" display="flex">
        <Button
          variant="text"
          size="small"
          onClick={() => {
            setLoginVisible(!loginVisible);
          }}
        >
          Admin Login
        </Button>
      </Grid>
    );
  }

  return (
    <Box component="form" noValidate sx={{ mt: 3 }} onSubmit={onSubmit}>
      <h2>Login</h2>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            name="email"
            placeholder="email"
            required
            fullWidth
            onChange={(e) => setData({ ...data, email: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            name="password"
            type="password"
            placeholder="password"
            required
            fullWidth
            onChange={(e) => setData({ ...data, password: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <Button fullWidth variant="contained" size="large" type="submit">
            Login
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      <Box sx={{ pb: 7, position: "relative", height: "100vh" }}>
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
          </Grid>
          <Grid item xs={3}>
            <BasicLogin />
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
}
