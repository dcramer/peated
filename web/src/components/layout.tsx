import { AccountBox, Favorite, LocalActivity } from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Typography,
} from "@mui/material";
import Container from "@mui/material/Container";
import { useNavigate } from "react-router-dom";

export default function Layout({
  children,
  title,
  appBar,
}: {
  children: any;
  title?: string;
  appBar?: any;
}) {
  const navigate = useNavigate();

  return (
    <Container
      maxWidth="sm"
      style={{
        position: "relative",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "88px",
        marginTop: "88px",
      }}
    >
      <AppBar style={{ flex: "0 0 auto" }}>
        <Container maxWidth="sm">
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ p: 1, textAlign: "center" }}
          >
            {title}
          </Typography>
          {appBar}
        </Container>
      </AppBar>
      {children}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0 }}>
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
      </div>
    </Container>
  );
}
