import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "~/components/ui/scroll-area";

interface InfiniteScrollListProps<T> {
  items: T[];
  hasMore: boolean;
  fetchUrl: string;
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onItemsLoaded: (newItems: T[], hasMore: boolean) => void;
}

export function InfiniteScrollList<T>({
  items,
  hasMore,
  fetchUrl,
  itemKey,
  renderItem,
  onItemsLoaded,
}: InfiniteScrollListProps<T>) {
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMoreRef = useRef<() => void>(undefined);
  loadMoreRef.current = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const separator = fetchUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${fetchUrl}${separator}offset=${items.length}`);
      const data = (await res.json()) as { messages: T[]; hasMore: boolean };
      onItemsLoaded(data.messages, data.hasMore);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current?.();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, items.length]);

  return (
    <ScrollArea className="h-[calc(100vh-13rem)]">
      <div className="space-y-4 pr-4">
        {items.map((item) => (
          <div key={itemKey(item)}>{renderItem(item)}</div>
        ))}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            <svg
              className="h-5 w-5 animate-spin text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
