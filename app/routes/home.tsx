import type { Route } from "./+types/home";
import { drizzle } from "drizzle-orm/d1";
import { desc } from "drizzle-orm";
import { messages } from "../../db/schema";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CEO Console" },
    { name: "description", content: "CEO Console — Message Dashboard" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const allMessages = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt));

  return { messages: allMessages };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { messages } = loaderData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            CEO Console
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {messages.length} message{messages.length !== 1 && "s"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No messages yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Messages sent to the API will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageCard key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MessageCard({ message }: { message: typeof messages.$inferSelect }) {
  const time = new Date(message.createdAt).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {message.from.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {message.from}
            </span>
            <time className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {time}
            </time>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {message.messageContent}
          </p>

          {message.possibleReplies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.possibleReplies.map((reply, i) => (
                <span
                  key={i}
                  className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {reply}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
