import type { Route } from "./+types/slack.events";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const body = await request.text();

  const isValid = await verifySlackSignature(request, body, env.SLACK_SIGNING_SECRET);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(body);

  if (payload.type === "url_verification") {
    return new Response(payload .challenge, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (payload.event?.type !== "app_mention") {
    return new Response("OK", { status: 200 });
  }

  const { text, user, channel } = payload.event as {
    text: string;
    user: string;
    channel: string;
  };
  const question = text.replace(/<@[A-Z0-9]+>/g, "").trim();
  const questionId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  const [userName, channelName] = await Promise.all([
    resolveUser(user, env.SLACK_BOT_TOKEN),
    resolveChannel(channel, env.SLACK_BOT_TOKEN),
  ]);

  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Slack → Nathan",
      content: `📨 **New question**\n**Question ID:** \`${questionId}\`\n**From:** ${userName}\n**Channel:** #${channelName}\n**Channel ID:** \`${channel}\`\n\n\`${question}\`\n\nDraft Slack replies to the question using the skill.`,
    }),
  });

  return new Response("OK", { status: 200 });
}

async function resolveUser(userId: string, token: string): Promise<string> {
  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as any;
  return data.user?.real_name || data.user?.name || userId;
}

async function resolveChannel(
  channelId: string,
  token: string
): Promise<string> {
  const res = await fetch(
    `https://slack.com/api/conversations.info?channel=${channelId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = (await res.json()) as any;
  return data.channel?.name || channelId;
}

async function verifySlackSignature(
  request: Request,
  body: string,
  signingSecret: string
): Promise<boolean> {
  const timestamp = request.headers.get("X-Slack-Request-Timestamp");
  const slackSignature = request.headers.get("X-Slack-Signature");

  if (!timestamp || !slackSignature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const sigBaseString = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sigBaseString)
  );
  const computed =
    "v0=" +
    Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return computed === slackSignature;
}
