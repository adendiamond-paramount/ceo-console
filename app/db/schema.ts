import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export function generateHexId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(generateHexId),
  messageContent: text("message_content").notNull(),
  from: text("from").notNull(),
  channel: text("channel"),
  possibleReplies: text("possible_replies", { mode: "json" })
    .notNull()
    .$type<string[]>(),
  sent: integer("sent", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("processing"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
