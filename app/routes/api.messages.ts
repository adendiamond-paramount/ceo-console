import type { Route } from "./+types/api.messages";
import { drizzle } from "drizzle-orm/d1";
import { messages } from "../../db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { message_content, from, possible_replies } = body;

  if (!message_content || !from || !Array.isArray(possible_replies)) {
    return Response.json(
      { error: "Missing required fields: message_content, from, possible_replies (array)" },
      { status: 400 }
    );
  }

  const db = drizzle(context.cloudflare.env.DB);

  const [inserted] = await db
    .insert(messages)
    .values({
      messageContent: message_content,
      from,
      possibleReplies: possible_replies,
    })
    .returning();

  return Response.json({ success: true, message: inserted });
}
