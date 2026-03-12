import type { Route } from "./+types/api.messages";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { messages } from "../db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const { question_id, message_content, from, channel, possible_replies } = body;

  if (!question_id || !message_content || !from || !channel || !Array.isArray(possible_replies)) {
    return Response.json(
      { error: "Missing required fields: question_id, message_content, from, channel, possible_replies (array)" },
      { status: 400 }
    );
  }

  const env = context.cloudflare.env;
  const db = drizzle(env.DB);

  try {
    const [updated] = await db
      .update(messages)
      .set({
        messageContent: message_content as string,
        from: from as string,
        channel: channel as string,
        possibleReplies: possible_replies as string[],
        status: "ready",
      })
      .where(eq(messages.id, question_id as string))
      .returning();

    if (!updated) {
      return Response.json({ error: "Message not found" }, { status: 404 });
    }

    const id = env.MESSAGE_RELAY.idFromName("global");
    const stub = env.MESSAGE_RELAY.get(id);
    context.cloudflare.ctx.waitUntil(
      stub.fetch(new Request("http://do/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: "message_updated", message: updated }),
      }))
    );

    return Response.json({ success: true, message: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return Response.json({ error: message }, { status: 500 });
  }
}
