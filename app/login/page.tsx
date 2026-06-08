import { redirect } from "next/navigation";

/** Legacy /login path → new login. Keeps old bookmarks/links working. */
export default function Page() {
  redirect("/v2/login");
}
