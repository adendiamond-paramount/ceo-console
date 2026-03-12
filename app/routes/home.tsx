import type { Route } from "./+types/home";
import { drizzle } from "drizzle-orm/d1";
import { count as dbCount, desc, eq } from "drizzle-orm";
import { messages } from "../db/schema";
import { Form, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Message = typeof messages.$inferSelect;

type WsEvent =
  | { type: "new_message"; message: Message }
  | { type: "message_sent"; id: string }
  | { type: "message_deleted"; id: string; wasSent: boolean };

const SENT_PAGE_SIZE = 10;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CEO Console" },
    { name: "description", content: "CEO Console — Message Dashboard" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const url = new URL(request.url);

  const sentPage = Math.max(1, parseInt(url.searchParams.get("sentPage") || "1", 10) || 1);
  const sentOffset = (sentPage - 1) * SENT_PAGE_SIZE;

  const [inbox, sent, sentCountResult] = await Promise.all([
    db.select().from(messages).where(eq(messages.sent, false)).orderBy(desc(messages.createdAt)),
    db
      .select()
      .from(messages)
      .where(eq(messages.sent, true))
      .orderBy(desc(messages.createdAt))
      .limit(SENT_PAGE_SIZE)
      .offset(sentOffset),
    db.select({ value: dbCount() }).from(messages).where(eq(messages.sent, true)),
  ]);

  const sentTotal = sentCountResult[0]?.value ?? 0;

  return { inbox, sent, sentPage, sentTotal };
}

type Folder = "inbox" | "sent";

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    inbox: loaderInbox,
    sent: loaderSent,
    sentPage,
    sentTotal: loaderSentTotal,
  } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const [inbox, setInbox] = useState(loaderInbox);
  const [sent, setSent] = useState(loaderSent);
  const [sentTotal, setSentTotal] = useState(loaderSentTotal);

  useEffect(() => { setInbox(loaderInbox); }, [loaderInbox]);
  useEffect(() => { setSent(loaderSent); }, [loaderSent]);
  useEffect(() => { setSentTotal(loaderSentTotal); }, [loaderSentTotal]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let alive = true;

    function connect() {
      if (!alive) return;
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/ws`);

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          switch (event.type) {
            case "new_message":
              setInbox((prev) => [event.message, ...prev]);
              toast.info(`New message from ${event.message.from}`);
              break;
            case "message_sent":
              setInbox((prev) => prev.filter((m) => m.id !== event.id));
              setSentTotal((prev) => prev + 1);
              break;
            case "message_deleted":
              if (event.wasSent) {
                setSent((prev) => prev.filter((m) => m.id !== event.id));
                setSentTotal((prev) => Math.max(0, prev - 1));
              } else {
                setInbox((prev) => prev.filter((m) => m.id !== event.id));
              }
              break;
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const folder: Folder = searchParams.get("folder") === "sent" ? "sent" : "inbox";
  const setFolder = (f: Folder) => {
    const next = new URLSearchParams(searchParams);
    if (f === "inbox") next.delete("folder");
    else next.set("folder", f);
    next.delete("sent");
    next.delete("sentPage");
    setSearchParams(next, { replace: true });
  };

  const sentTotalPages = Math.max(1, Math.ceil(sentTotal / SENT_PAGE_SIZE));

  const goToSentPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete("sentPage");
    else next.set("sentPage", String(page));
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
            count={sentTotal}
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

        {folder === "sent" && sentTotalPages > 1 && (
          <Pagination
            currentPage={sentPage}
            totalPages={sentTotalPages}
            onPageChange={goToSentPage}
          />
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
              <Form method="post" action={`/api/delete/${message.id}`}>
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm("Delete this message?")) e.preventDefault();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  title="Delete message"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </Form>
            </div>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {message.messageContent}
          </p>

          {folder === "inbox" && (
            <div className="mt-3 space-y-2">
              {message.possibleReplies.map((reply, i) => (
                <Form key={i} method="post" action={`/api/post/${message.id}/${i}`}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">{reply}</span>
                    <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </button>
                </Form>
              ))}
              <a
                href={`/post/${message.id}/custom`}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-transparent px-4 py-3 text-left text-sm transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-600 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                  <svg className="h-3 w-3 text-neutral-500 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                  </svg>
                </span>
                <span className="flex-1 italic text-neutral-400 dark:text-neutral-500">Write your own reply…</span>
              </a>
            </div>
          )}

        </div>
      </div>

      {message.possibleReplies.length > 0 && folder === "sent" && (
        <div className="flex items-start gap-4 border-t border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            You
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
            {message.possibleReplies[0]}
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const btnBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors";

  return (
    <div className="mt-8 flex items-center justify-center gap-1.5">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`${btnBase} border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-neutral-400 dark:text-neutral-500">
            &hellip;
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btnBase} ${
              p === currentPage
                ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`${btnBase} border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}
