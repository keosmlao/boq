/**
 * v2 (app) layout — wraps every authenticated rebuild page in the shell.
 * The login page lives in the (auth) group and is NOT wrapped by this layout.
 * `LanguageProvider` now lives in the root layout (app/layout.tsx) so that the
 * logged-out routes get the locale too; this layout inherits it.
 */
import Shell from "./_components/Shell";

export default function V2AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
