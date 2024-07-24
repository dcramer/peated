import theme from "@peated/design";
import tailwindConfig from "@peated/design/tailwind/base";
import { Body, Container, Head, Html, Img, Section, Tailwind } from "jsx-email";
import type { ReactNode } from "react";

export default function Layout({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Tailwind config={tailwindConfig} production>
        <Body
          className="m-auto bg-white font-sans lg:p-2"
          style={{ backgroundColor: theme.colors.slate[900] }}
        >
          <Container className="max-w-[540px]">
            <Container className="rounded border-solid border-slate-700 bg-slate-900 lg:border">
              <Section className="bg-highlight rounded-t border border-solid border-slate-900 px-[20px] py-[10px]">
                <Img
                  src={`${baseUrl}/assets/glyph-black.png`}
                  width="96"
                  height="96"
                  alt="Peated"
                  className="mx-auto my-0"
                />
              </Section>
              {children}
            </Container>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
