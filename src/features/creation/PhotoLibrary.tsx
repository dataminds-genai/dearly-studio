import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import birthday from "@/assets/occasion-library/birthday.jpg";
import love from "@/assets/occasion-library/love.jpg";
import mothersDay from "@/assets/occasion-library/mothers-day.jpg";
import fathersDay from "@/assets/occasion-library/fathers-day.jpg";
import congratulations from "@/assets/occasion-library/congratulations.jpg";
import getWell from "@/assets/occasion-library/get-well.jpg";
import sympathy from "@/assets/occasion-library/sympathy.jpg";
import friendship from "@/assets/occasion-library/friendship.jpg";
import holidays from "@/assets/occasion-library/holidays.jpg";
import thankYou1 from "@/assets/occasion-library/thank-you-1.jpg";
import thankYou2 from "@/assets/occasion-library/thank-you-2.jpg";
import thankYou3 from "@/assets/occasion-library/thank-you-3.jpg";
import thankYou4 from "@/assets/occasion-library/thank-you-4.jpg";
import thinkingOfYou1 from "@/assets/occasion-library/thinking-of-you-1.jpg";
import thinkingOfYou2 from "@/assets/occasion-library/thinking-of-you-2.jpg";
import thinkingOfYou3 from "@/assets/occasion-library/thinking-of-you-3.jpg";
import thinkingOfYou4 from "@/assets/occasion-library/thinking-of-you-4.jpg";
import graduation1 from "@/assets/occasion-library/graduation-1.jpg";
import graduation2 from "@/assets/occasion-library/graduation-2.jpg";
import graduation3 from "@/assets/occasion-library/graduation-3.jpg";
import graduation4 from "@/assets/occasion-library/graduation-4.jpg";
import newBaby1 from "@/assets/occasion-library/new-baby-1.jpg";
import newBaby2 from "@/assets/occasion-library/new-baby-2.jpg";
import newBaby3 from "@/assets/occasion-library/new-baby-3.jpg";
import newBaby4 from "@/assets/occasion-library/new-baby-4.jpg";
import wedding1 from "@/assets/occasion-library/wedding-1.jpg";
import wedding2 from "@/assets/occasion-library/wedding-2.jpg";
import wedding3 from "@/assets/occasion-library/wedding-3.jpg";
import wedding4 from "@/assets/occasion-library/wedding-4.jpg";
import family1 from "@/assets/occasion-library/family-1.jpg";
import family2 from "@/assets/occasion-library/family-2.jpg";
import family3 from "@/assets/occasion-library/family-3.jpg";
import family4 from "@/assets/occasion-library/family-4.jpg";

interface LibGroup {
  occasion: string;
  photos: string[];
}

export interface SearchPhoto {
  id: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  downloadBeacon: string;
}

const groups: LibGroup[] = [
  { occasion: "Birthday", photos: [birthday] },
  { occasion: "Love & Anniversary", photos: [love] },
  { occasion: "Mother's Day", photos: [mothersDay] },
  { occasion: "Father's Day", photos: [fathersDay] },
  { occasion: "Congratulations", photos: [congratulations] },
  { occasion: "Get Well", photos: [getWell] },
  { occasion: "Sympathy", photos: [sympathy] },
  { occasion: "Friendship", photos: [friendship] },
  { occasion: "Holidays", photos: [holidays] },
  { occasion: "Thank You", photos: [thankYou1, thankYou2, thankYou3, thankYou4] },
  {
    occasion: "Thinking of You",
    photos: [thinkingOfYou1, thinkingOfYou2, thinkingOfYou3, thinkingOfYou4],
  },
  { occasion: "Graduation", photos: [graduation1, graduation2, graduation3, graduation4] },
  { occasion: "New Baby", photos: [newBaby1, newBaby2, newBaby3, newBaby4] },
  { occasion: "Wedding", photos: [wedding1, wedding2, wedding3, wedding4] },
  { occasion: "Family", photos: [family1, family2, family3, family4] },
];

export function PhotoLibrary({
  onSelect,
  triggerLabel,
  triggerVariant = "ghost",
  triggerClassName,
}: {
  onSelect: (photo: { src: string; label: string; width: number; height: number }) => void;
  triggerLabel?: string;
  triggerVariant?: "ghost" | "outline" | "default";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<"library" | "search">("library");
  const [filter, setFilter] = useState("All");
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPhoto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const occasions = ["All", ...groups.map((g) => g.occasion)];
  const visible = filter === "All" ? groups : groups.filter((g) => g.occasion === filter);

  useEffect(() => {
    if (!open || pane !== "search") return;
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/photo-search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { photos: SearchPhoto[] };
        setResults(json.photos);
        setSearchError(null);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed.");
        setResults([]);
      } finally {
        setSearching(false);
        setSearched(true);
      }
    }, 500);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open, pane]);

  async function selectSearchPhoto(photo: SearchPhoto) {
    // Mandatory Unsplash view-tracking; failure must not block the user.
    fetch("/api/photo-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadBeacon: photo.downloadBeacon }),
    }).catch(() => undefined);
    onSelect({ src: photo.full, label: "Unsplash", width: photo.width, height: photo.height });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="sm"
          className={cn("gap-2 rounded-full", triggerClassName)}
        >
          <Images className="size-4" aria-hidden="true" />
          {triggerLabel ? (
            <span>{triggerLabel}</span>
          ) : (
            <>
              <span className="hidden sm:inline">Library</span>
              <span className="sr-only sm:hidden">Photo library</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Occasion photo library</DialogTitle>
          <DialogDescription>
            Choose a complimentary Unsplash photo for your card.
          </DialogDescription>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Photo source"
          className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        >
          {(["library", "search"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pane === p}
              onClick={() => setPane(p)}
              className={cn(
                "rounded-full py-1.5 text-[14px] font-medium transition-colors",
                pane === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {p === "library" ? "Library" : "Search photos"}
            </button>
          ))}
        </div>
        {pane === "library" ? (
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {occasions.map((occasion) => (
              <button
                key={occasion}
                type="button"
                onClick={() => setFilter(occasion)}
                className={cn(
                  "tap-safe shrink-0 rounded-full border px-3 text-sm",
                  filter === occasion
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {occasion}
              </button>
            ))}
          </div>
        ) : (
          <label className="relative block">
            <span className="sr-only">Search Unsplash photos</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try graduation, picnic, sunset…"
              className="h-11 rounded-xl pl-9"
            />
          </label>
        )}
        {pane === "search" ? (
          <div aria-live="polite">
            {searching ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Searching photos…
              </p>
            ) : searchError ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{searchError}</p>
            ) : !searched ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Type above to search thousands of Unsplash photos.
              </p>
            ) : results.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing found — try a different word.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="group overflow-hidden rounded-xl border border-border bg-card text-left"
                    onClick={() => void selectSearchPhoto(photo)}
                  >
                    <span className="relative block aspect-[4/3] w-full overflow-hidden">
                      {!loaded[photo.id] ? (
                        <Skeleton className="absolute inset-0 rounded-none" />
                      ) : null}
                      <img
                        src={photo.thumb}
                        alt={photo.alt}
                        loading="lazy"
                        onLoad={() => setLoaded((l) => ({ ...l, [photo.id]: true }))}
                        className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    </span>
                    <span className="block truncate px-3 pt-2 text-sm font-medium">
                      {photo.alt}
                    </span>
                    <span className="block truncate px-3 pb-2 text-xs text-muted-foreground">
                      Photo by{" "}
                      <a
                        href={photo.photographerUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="underline"
                      >
                        {photo.photographer}
                      </a>{" "}
                      on Unsplash
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {pane === "library"
          ? visible.map((group) => (
              <div key={group.occasion}>
                <p className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.occasion} · {group.photos.length}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {group.photos.map((src, i) => {
                    const key = `${group.occasion}-${i}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="group overflow-hidden rounded-xl border border-border bg-card text-left"
                        onClick={(e) => {
                          const img = e.currentTarget.querySelector("img");
                          onSelect({
                            src,
                            label: group.occasion,
                            width: img?.naturalWidth || 1200,
                            height: img?.naturalHeight || 800,
                          });
                          setOpen(false);
                        }}
                      >
                        <span className="relative block aspect-[4/3] w-full overflow-hidden">
                          {!loaded[key] ? (
                            <Skeleton className="absolute inset-0 rounded-none" />
                          ) : null}
                          <img
                            src={src}
                            alt={group.occasion}
                            loading="lazy"
                            onLoad={() => setLoaded((l) => ({ ...l, [key]: true }))}
                            className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                          />
                        </span>
                        <span className="block px-3 py-2 text-sm font-medium">
                          {group.occasion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          : null}
        <p className="text-xs text-muted-foreground">
          Photos from{" "}
          <a
            className="underline"
            href="https://unsplash.com/?utm_source=dearly_studio&utm_medium=referral"
            target="_blank"
            rel="noreferrer"
          >
            Unsplash
          </a>
          , used under the Unsplash License. New additions by contributing Unsplash photographers.
        </p>
      </DialogContent>
    </Dialog>
  );
}
