import type { Route } from "./+types/api.inbox";
import { getDb, fetchMessages } from "../db/queries";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  return Response.json(await fetchMessages(db, false, offset));
}
