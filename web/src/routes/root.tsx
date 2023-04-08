import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
} from "@mui/material";
import { AccountBox, Favorite, LocalActivity } from "@mui/icons-material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useEffect } from "react";
import Layout from "../components/layout";

export default function Root() {
  const navigate = useNavigate();
  const location = useLocation();

  const auth = useAuth();
  useEffect(() => {
    if (!auth.user) {
      navigate("/login");
    }
  });

  if (!auth.user) return null;

  return (
    <Layout>
      <Box sx={{ pb: 7, position: "relative", height: "100vh" }}>
        <Outlet />
      </Box>

      <Paper
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        elevation={3}
      >
        <BottomNavigation
          showLabels
          value={location.pathname}
          onChange={(_, newPath) => {
            navigate(newPath);
          }}
        >
          <BottomNavigationAction
            value="/"
            href="/"
            label="Activity"
            icon={<LocalActivity />}
          />
          <BottomNavigationAction
            value="/favorites"
            label="Favorites"
            icon={<Favorite />}
          />
          <BottomNavigationAction
            value="/profile"
            label="Profile"
            icon={<AccountBox />}
          />
        </BottomNavigation>
      </Paper>
    </Layout>
  );
}
