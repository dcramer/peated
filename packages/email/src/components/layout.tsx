import theme from "@peated/design";
import tailwindConfig from "@peated/design/tailwind/base";
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Section,
  Tailwind,
} from "jsx-email";
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
            <Container className="rounded border-solid border-slate-700 bg-slate-900 pb-[32px] lg:border">
              <Section className="bg-highlight mb-[16px] rounded-t border border-solid border-slate-900 px-[16px] py-[16px]">
                <Column className="text-center">
                  <Link
                    href={baseUrl}
                    disableDefaultStyle
                    className="no-underline"
                  >
                    <Img
                      src={`${baseUrl}/assets/glyph-black.png`}
                      width="96"
                      height="96"
                      alt="Peated"
                      className="mx-auto"
                      disableDefaultStyle
                    />
                  </Link>
                </Column>
              </Section>
              {children}
            </Container>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
