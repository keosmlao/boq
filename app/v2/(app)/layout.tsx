/**
 * v2 (app) layout — wraps every authenticated rebuild page in the shell.
 * The login page lives in the (auth) group and is NOT wrapped by this layout.
 */
import Shell from "./_components/Shell";

export default function V2AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
