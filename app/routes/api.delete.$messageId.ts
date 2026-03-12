import type { Route } from "./+types/api.delete.$messageId";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { redirect, data } from "react-router";

export async function action({ params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB);
  const messageId = params.messageId;

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  if (!message) {
    throw data("Message not found", { status: 404 });
  }

  await db.delete(messages).where(eq(messages.id, messageId));

  const relayId = env.MESSAGE_RELAY.idFromName("global");
  const relay = env.MESSAGE_RELAY.get(relayId);
  context.cloudflare.ctx.waitUntil(
    relay.fetch(new Request("http://do/broadcast", {
      method: "POST",
      body: JSON.stringify({ type: "message_deleted", id: messageId, wasSent: message.sent }),
    }))
  );

  const folder = message.sent ? "?folder=sent" : "";
  return redirect(`/${folder}`);
}
