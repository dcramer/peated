import { Avatar, Box, Button, Stack, Typography } from "@mui/material";
import { useRequiredAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout";

export default function Profile() {
  const navigate = useNavigate();
  const { logout, user } = useRequiredAuth();

  return (
    <Layout title="Profile">
      <Stack spacing={2} direction="column" alignItems="center">
        <Avatar>{user.displayName.substring(0, 1)}</Avatar>
        <Typography variant="h1">{user.displayName}</Typography>

        <Button
          variant="outlined"
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          Logout
        </Button>
      </Stack>
    </Layout>
  );
}
