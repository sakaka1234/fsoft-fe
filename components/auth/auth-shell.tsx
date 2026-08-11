import { Art } from "@/components/ui/art";
import { Container } from "@/components/ui/container";

type AuthShellProps = {
  title: string;
  lead: string;
  art: { src: string; alt: string };
  children: React.ReactNode;
  /** Sign in / sign up cross link, rendered under the form. */
  footer: React.ReactNode;
};

/** Split layout shared by sign in and sign up: artwork left, form right. */
export function AuthShell({
  title,
  lead,
  art,
  children,
  footer,
}: AuthShellProps) {
  return (
    <Container size="wide">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="hidden lg:col-span-6 lg:block">
          <Art
            src={art.src}
            alt={art.alt}
            float
            priority
            sizes="(min-width: 1024px) 45vw, 0px"
            className="aspect-square"
          />
        </div>

        <div className="mx-auto w-full max-w-md lg:col-span-6">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{lead}</p>

          <div className="mt-9">{children}</div>

          <div className="mt-8 border-t border-line pt-6 text-sm text-muted">
            {footer}
          </div>
        </div>
      </div>
    </Container>
  );
}
