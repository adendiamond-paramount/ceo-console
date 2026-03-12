import type { Route } from "./+types/api.inbox";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { messages } from "../db/schema";

const PAGE_SIZE = 10;

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const url = new URL(request.url);

  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sent, false))
    .orderBy(desc(messages.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return Response.json({ messages: rows, hasMore: rows.length === PAGE_SIZE });
}
