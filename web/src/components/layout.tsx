import {
  AccountBox,
  Close as CloseIcon,
  Favorite,
  LocalActivity,
} from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import Container from "@mui/material/Container";
import { useNavigate } from "react-router-dom";

export default function Layout({
  children,
  title,
  appBar,
  hideAppBar,
  onClose,
  onSave,
}: {
  children: any;
  title?: string;
  appBar?: any;
  hideAppBar?: boolean;
  onClose?: any;
  onSave?: any;
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
        marginTop: hideAppBar ? "12px" : "88px",
      }}
    >
      {!hideAppBar && (
        <AppBar style={{ flex: "0 0 auto" }}>
          <Container maxWidth="sm">
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={3}>
                {onClose && (
                  <IconButton onClick={onClose}>
                    <CloseIcon />
                  </IconButton>
                )}
              </Grid>
              <Grid
                item
                xs={6}
                zeroMinWidth
                justifyContent="center"
                sx={{ flex: 1, display: "flex" }}
              >
                {title && (
                  <Typography
                    variant="h6"
                    noWrap
                    component="div"
                    sx={{ p: 1, textAlign: "center" }}
                  >
                    {title}
                  </Typography>
                )}
              </Grid>
              <Grid
                item
                xs={3}
                justifyContent="flex-end"
                sx={{ display: "flex" }}
              >
                {onSave && <Button onClick={onSave}>Save</Button>}
              </Grid>
            </Grid>
            {appBar}
          </Container>
        </AppBar>
      )}
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
