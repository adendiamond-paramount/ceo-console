import type { Route } from "./+types/post.$messageId.$replyIndex";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { data, redirect, isRouteErrorResponse } from "react-router";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB);
  const messageId = params.messageId;
  const replyIndex = parseInt(params.replyIndex);

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  if (!message) {
    throw data("Message not found", { status: 404 });
  }

  if (replyIndex < 0 || replyIndex >= message.possibleReplies.length) {
    throw data("Invalid reply index", { status: 400 });
  }

  if (!message.channel) {
    throw data("This message has no Slack channel associated with it.", { status: 422 });
  }

  if (message.sent) {
    return redirect("/?sent=true");
  }

  const replyText = message.possibleReplies[replyIndex];

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
    throw data(`Slack error: ${result.error}`, { status: 502 });
  }

  await db
    .update(messages)
    .set({ sent: true })
    .where(eq(messages.id, messageId));

  return redirect("/?sent=true");
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let detail = "An unexpected error occurred while sending your reply.";

  if (isRouteErrorResponse(error)) {
    title =
      error.status === 404
        ? "Message not found"
        : error.status === 400
          ? "Invalid request"
          : error.status === 422
            ? "Cannot send"
            : error.status === 502
              ? "Slack error"
              : `Error ${error.status}`;
    detail =
      typeof error.data === "string"
        ? error.data
        : error.statusText || detail;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {detail}
          </p>
        </div>
        <a
          href="/"
          className="inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
