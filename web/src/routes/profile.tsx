import { Avatar, Box, Button, Stack, Typography } from "@mui/material";
import useAuth from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  if (!user) return null;

  return (
    <Box sx={{ pt: 8 }}>
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
    </Box>
  );
}
