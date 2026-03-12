import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageContent: text("message_content").notNull(),
  from: text("from").notNull(),
  possibleReplies: text("possible_replies", { mode: "json" })
    .notNull()
    .$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
