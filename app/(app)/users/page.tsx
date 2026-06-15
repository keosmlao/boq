/**
 * v2 users list — SERVER component.
 *
 * The user rows are fetched here, on the server, during render and handed to
 * the interactive client (UsersClient) as `initialRows`. This removes the old
 * client-side mount→useEffect→server-action→DB waterfall: the data is already
 * in the first HTML/RSC payload, so navigating to /users no longer shows a
 * second in-page spinner after the route JS loads. The create/update/delete
 * flows and the manual refresh button still re-pull via the server action.
 *
 * `force-dynamic` keeps the list fresh per request (and avoids a build-time DB
 * hit).
 */
import { getUsers, type AppUserRow } from "@/_actions/users";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const res: any = await getUsers();
  const initialRows: AppUserRow[] = res?.success ? res.data : [];
  return <UsersClient initialRows={initialRows} />;
}
