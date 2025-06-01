import { Body, Container, Head, Html, Img, Section } from "jsx-email";
import type { ReactNode } from "react";
import React from "react";
import { colors } from "../constants";

const styles = `
body {
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    "Noto Sans",
    sans-serif,
    "Apple Color Emoji",
    "Segoe UI Emoji",
    "Segoe UI Symbol",
    "Noto Color Emoji";
}

@media (min-width: 1024px) {
  body {
    padding: 8px;
  }

  .main {
    margin: 8px 0;
    border-width: 2px;
  }
}
`;

export default function Layout({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <Head />
      <Body
        style={{
          margin: "auto",
          backgroundColor: colors.slate[900],
        }}
      >
        <Container
          style={{
            maxWidth: "540px",
          }}
        >
          <Container
            style={{
              borderStyle: "solid",
              borderColor: colors.slate[800],
              paddingBottom: "16px",
              borderRadius: "0 0 4px 4px",
            }}
            className="main"
          >
            <Section
              style={{
                backgroundColor: colors.highlight,
                borderRadius: "4px 4px 0 0",
                padding: "10px 24px",
                marginBottom: "16px",
              }}
            >
              <Img
                src={`${baseUrl}/assets/glyph-black.png`}
                width="96"
                height="96"
                alt="Peated"
                style={{
                  margin: "0 auto",
                }}
              />
            </Section>
            {children}
          </Container>
        </Container>
      </Body>
    </Html>
  );
}
