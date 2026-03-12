import type { Route } from "./+types/api.post.$messageId.$replyIndex";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { data, redirect } from "react-router";

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB);
  const messageId = params.messageId;
  const isCustom = params.replyIndex === "custom";
  const replyIndex = isCustom ? -1 : parseInt(params.replyIndex);

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  if (!message) {
    throw data("Invalid message", { status: 400 });
  }

  if (!isCustom && (replyIndex < 0 || replyIndex >= message.possibleReplies.length)) {
    throw data("Invalid reply index", { status: 400 });
  }

  if (!message.channel) {
    return data({ error: "This message has no Slack channel associated with it." }, { status: 422 });
  }

  const formData = await request.formData();
  const customText = formData.get("text");
  const replyText = typeof customText === "string" && customText.trim()
    ? customText.trim()
    : isCustom
      ? null
      : message.possibleReplies[replyIndex];

  if (!replyText) {
    throw data("Reply text is required", { status: 400 });
  }

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: message.channel,
      text: `<@${message.from}> ${replyText}`,
    }),
  });

  const result = (await slackRes.json()) as { ok: boolean; error?: string };

  if (!result.ok) {
    return data({ error: `Slack error: ${result.error}` }, { status: 422 });
  }

  await db
    .update(messages)
    .set({ sent: true })
    .where(eq(messages.id, messageId));

  const relayId = env.MESSAGE_RELAY.idFromName("global");
  const relay = env.MESSAGE_RELAY.get(relayId);
  context.cloudflare.ctx.waitUntil(
    relay.fetch(new Request("http://do/broadcast", {
      method: "POST",
      body: JSON.stringify({ type: "message_sent", id: messageId }),
    }))
  );

  return redirect("/?sent=true");
}
