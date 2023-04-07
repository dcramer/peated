import { Grid, Typography } from "@mui/material";
import { LoaderFunction, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../lib/api";
import useAuth from "../hooks/useAuth";
import Layout from "../components/layout";

type LoaderData = {};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  return {};
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
        </Grid>
      </Grid>
    </Layout>
  );
}
