import type { Route } from "./+types/api.messages";
import { drizzle } from "drizzle-orm/d1";
import { messages } from "../db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const { message_content, from, channel, possible_replies } = body;

  if (!message_content || !from || !channel || !Array.isArray(possible_replies)) {
    return Response.json(
      { error: "Missing required fields: message_content, from, channel, possible_replies (array)" },
      { status: 400 }
    );
  }

  const db = drizzle(context.cloudflare.env.DB);

  try {
    const [inserted] = await db
      .insert(messages)
      .values({
        messageContent: message_content as string,
        from: from as string,
        channel: channel as string,
        possibleReplies: possible_replies as string[],
      })
      .returning();

    return Response.json({ success: true, message: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return Response.json({ error: message }, { status: 500 });
  }
}
