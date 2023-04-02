import Container from "@mui/material/Container";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { AccountBox, Favorite, LocalActivity } from "@mui/icons-material";
import { Outlet, useLocation } from "react-router-dom";

export default function Root() {
  const location = useLocation();

  return (
    <Container maxWidth="sm" style={{ position: "relative", height: "100vh" }}>
      <Outlet />

      <Paper
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
        elevation={3}
      >
        <BottomNavigation showLabels value={location.pathname}>
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
    </Container>
  );
}
