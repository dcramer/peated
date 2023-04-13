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
import Screen from "../components/screen";

export default function Root() {
  const navigate = useNavigate();

  const auth = useAuth();
  useEffect(() => {
    if (!auth.user) {
      navigate("/login");
    }
  });

  if (!auth.user) return null;

  return (
    <Screen>
      <Outlet />
    </Screen>
  );
}
