import { Box } from "@mui/material";
import useAuth from "../hooks/useAuth";

export default function Favorites() {
  const { user } = useAuth();
  if (!user) return null;

  return <Box>Favorites</Box>;
}
