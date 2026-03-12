import type { Route } from "./+types/slack.post";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;

  let body: { channel: string; text: string };
  try {
    body = (await request.json()) as { channel: string; text: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.channel || !body.text) {
    return Response.json(
      { error: "Missing required fields: channel, text" },
      { status: 400 }
    );
  }

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: body.channel,
      text: body.text,
    }),
  });

  const result = (await slackRes.json()) as {
    ok: boolean;
    error?: string;
    ts?: string;
    channel?: string;
  };

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, ts: result.ts, channel: result.channel });
}
