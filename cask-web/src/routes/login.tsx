import { Container, Grid, Typography } from "@mui/material";
import type { LoaderFunction } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import defaultClient from "../lib/api";

type LoaderData = {};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  return {};
};

export default function Login() {
  return (
    <Container maxWidth="sm">
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ minHeight: "100vh" }}
      >
        <Grid item xs={3}>
          <Typography variant="h1">Casked</Typography>
        </Grid>
        <Grid item xs={3}>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              await defaultClient.post("/auth/google", {
                token: credentialResponse.credential,
              });
              console.log(credentialResponse);
            }}
            onError={() => {
              console.log("Login Failed");
            }}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
