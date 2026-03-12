import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { count as dbCount, desc, eq } from "drizzle-orm";
import { messages } from "./schema";

const PAGE_SIZE = 10;

export function getDb(d1: D1Database) {
  return drizzle(d1);
}

export async function fetchMessages(
  db: DrizzleD1Database,
  sent: boolean,
  offset = 0,
) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sent, sent))
    .orderBy(desc(messages.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { messages: rows, hasMore: rows.length === PAGE_SIZE };
}

export async function countMessages(db: DrizzleD1Database, sent: boolean) {
  const result = await db
    .select({ value: dbCount() })
    .from(messages)
    .where(eq(messages.sent, sent));

  return result[0]?.value ?? 0;
}
