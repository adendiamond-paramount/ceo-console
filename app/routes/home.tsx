import type { Route } from "./+types/home";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { useSearchParams } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";


export function meta({}: Route.MetaArgs) {
  return [
    { title: "CEO Console" },
    { name: "description", content: "CEO Console — Message Dashboard" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);

  const [inbox, sent] = await Promise.all([
    db.select().from(messages).where(eq(messages.sent, false)).orderBy(desc(messages.createdAt)),
    db.select().from(messages).where(eq(messages.sent, true)).orderBy(desc(messages.createdAt)),
  ]);

  return { inbox, sent };
}

type Folder = "inbox" | "sent";

export default function Home({ loaderData }: Route.ComponentProps) {
  const { inbox, sent } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const folder: Folder = searchParams.get("folder") === "sent" ? "sent" : "inbox";
  const setFolder = (f: Folder) => {
    const next = new URLSearchParams(searchParams);
    if (f === "inbox") next.delete("folder");
    else next.set("folder", f);
    next.delete("sent");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (searchParams.get("sent") === "true") {
      toast.success("Reply sent to Slack successfully.");
      const next = new URLSearchParams(searchParams);
      next.delete("sent");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const current = folder === "inbox" ? inbox : sent;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            CEO Console
          </h1>
        </div>
        <nav className="mx-auto flex max-w-5xl px-6">
          <FolderTab
            active={folder === "inbox"}
            onClick={() => setFolder("inbox")}
            label="Inbox"
            count={inbox.length}
          />
          <FolderTab
            active={folder === "sent"}
            onClick={() => setFolder("sent")}
            label="Sent"
            count={sent.length}
          />
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {current.length === 0 ? (
          <EmptyState folder={folder} />
        ) : (
          <div className="space-y-4">
            {current.map((msg) => (
              <MessageCard key={msg.id} message={msg} folder={folder} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FolderTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "text-neutral-900 dark:text-neutral-100"
          : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      }`}
    >
      {label}
      <span
        className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
          active
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
        }`}
      >
        {count}
      </span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
      )}
    </button>
  );
}

function EmptyState({ folder }: { folder: Folder }) {
  const isInbox = folder === "inbox";
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
        <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {isInbox ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          )}
        </svg>
      </div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {isInbox ? "Inbox is empty" : "No sent messages yet"}
      </p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {isInbox
          ? "New messages from Slack will appear here."
          : "Replies you send will move here."}
      </p>
    </div>
  );
}

function MessageCard({ message, folder }: { message: typeof messages.$inferSelect; folder: Folder }) {
  const time = new Date(message.createdAt).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {message.from.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {message.from}
            </span>
            <div className="flex items-center gap-2">
              {folder === "sent" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  Sent
                </span>
              )}
              <time className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                {time}
              </time>
            </div>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {message.messageContent}
          </p>

          {message.possibleReplies.length > 0 && folder === "inbox" && (
            <div className="mt-3 space-y-2">
              {message.possibleReplies.map((reply, i) => (
                <a
                  key={i}
                  href={`/post/${message.id}/${i}`}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    {i + 1}
                  </span>
                  <span className="flex-1 leading-relaxed">{reply}</span>
                  <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </a>
              ))}
            </div>
          )}

          {message.possibleReplies.length > 0 && folder === "sent" && (
            <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
              {message.possibleReplies[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
