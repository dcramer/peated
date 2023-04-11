import Container from "@mui/material/Container";

export default function Layout({ children }: { children: any }) {
  return (
    <Container
      maxWidth="sm"
      style={{
        position: "relative",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Container>
  );
}
