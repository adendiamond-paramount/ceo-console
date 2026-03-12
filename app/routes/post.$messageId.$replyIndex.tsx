import type { Route } from "./+types/post.$messageId.$replyIndex";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { data, Form, isRouteErrorResponse } from "react-router";
import { useEffect, useRef, useState } from "react";

export async function loader({ params, context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const messageId = params.messageId;
  const isCustom = params.replyIndex === "custom";
  const replyIndex = isCustom ? -1 : parseInt(params.replyIndex);

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  if (!message) {
    throw data("Message not found", { status: 404 });
  }

  if (!isCustom && (replyIndex < 0 || replyIndex >= message.possibleReplies.length)) {
    throw data("Invalid reply index", { status: 400 });
  }

  return { message, replyIndex, isCustom };
}

export default function EditReply({ loaderData }: Route.ComponentProps) {
  const { message, replyIndex, isCustom } = loaderData;
  const [text, setText] = useState(isCustom ? "" : message.possibleReplies[replyIndex]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const time = new Date(message.createdAt).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  useEffect(() => {
    if (!message.sent) textareaRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-5">
          <a
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </a>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {isCustom ? "Write Reply" : "Edit & Send Reply"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {message.sent && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/40">
            <svg className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              This message has already been sent to Slack.
            </p>
          </div>
        )}

        <div className={`rounded-xl border shadow-sm ${
          message.sent
            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
            : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        }`}>
          <div className={`border-b px-6 py-4 ${
            message.sent
              ? "border-green-100 dark:border-green-800/60"
              : "border-neutral-100 dark:border-neutral-800"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                message.sent
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              }`}>
                {message.from.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {message.from}
                </p>
                <time className="text-xs text-neutral-400 dark:text-neutral-500">
                  {time}
                </time>
              </div>
              {message.sent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Sent
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Original Message
            </label>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {message.messageContent}
            </p>
          </div>

          <Form method="post" action={`/api/post/${message.id}/${isCustom ? "custom" : replyIndex}`}>
            <div className={`border-t px-6 py-5 ${
              message.sent ? "border-green-100 dark:border-green-800/60" : "border-neutral-100 dark:border-neutral-800"
            }`}>
              <label
                htmlFor="reply-text"
                className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
              >
                {message.sent ? "Sent Reply" : "Your Reply"}
              </label>
              <textarea
                ref={textareaRef}
                id="reply-text"
                name="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={message.sent}
                rows={4}
                placeholder={isCustom ? "Type your reply here…" : undefined}
                className={`mt-2 w-full resize-y rounded-lg border px-4 py-3 text-sm leading-relaxed outline-none transition-colors ${
                  message.sent
                    ? "border-green-200 bg-green-50/50 text-neutral-700 dark:border-green-800 dark:bg-green-950/30 dark:text-neutral-300 cursor-default"
                    : "border-neutral-200 bg-neutral-50 text-neutral-800 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:focus:border-blue-600 dark:focus:bg-neutral-800 dark:focus:ring-blue-900/40"
                }`}
              />
            </div>

            {!message.sent && message.possibleReplies.length > 0 && (isCustom || message.possibleReplies.length > 1) && (
              <div className="border-t border-neutral-100 px-6 py-4 dark:border-neutral-800">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Suggested replies
                </p>
                <div className="mt-2 space-y-1.5">
                  {message.possibleReplies.map((reply, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setText(reply)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                        text === reply
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                        {i + 1}
                      </span>
                      <span className="flex-1 leading-relaxed">{reply}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`border-t px-6 py-4 ${
              message.sent ? "border-green-100 dark:border-green-800/60" : "border-neutral-100 dark:border-neutral-800"
            }`}>
                <div className="flex items-center justify-end gap-3">
                  <a
                    href="/"
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    {message.sent ? "Back" : "Cancel"}
                  </a>
                  {!message.sent && (
                    <button
                      type="submit"
                      disabled={!text.trim()}
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Send to Slack
                    </button>
                  )}
                </div>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let detail = "An unexpected error occurred while loading this reply.";

  if (isRouteErrorResponse(error)) {
    title =
      error.status === 404
        ? "Message not found"
        : error.status === 400
          ? "Invalid request"
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
