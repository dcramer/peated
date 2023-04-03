import { Box } from "@mui/material";
import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

type LoaderData = {
  auth: any;
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const auth = {};

  return { auth };
};

export default function Welcome() {
  const { auth } = useLoaderData() as LoaderData;

  return (
    <Box sx={{ position: "relative", height: "100vh" }}>
      <button>Login with Google</button>
    </Box>
  );
}
