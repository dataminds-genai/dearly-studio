import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Calendar, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleOrders } from "@/domain/samples";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Scheduled cards — Dearly Studio" },
      {
        name: "description",
        content: "Cards waiting to be delivered, and ones already sent.",
      },
      { property: "og:title", content: "Scheduled — Dearly Studio" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScheduledCards,
});

interface ScheduledItem {
  id: string;
  recipient: string;
  occasion: string;
  when: string;
  channel: "Link" | "Text" | "Email" | "Print";
  repeatYearly: boolean;
  color: string;
  isUpcoming: boolean;
  orderId?: string;
}

const defaultScheduled: ScheduledItem[] = [
  {
    id: "sch-1",
    recipient: "Mum",
    occasion: "Birthday",
    when: "Sat 24 Oct, 09:00",
    channel: "Link",
    repeatYearly: true,
    color: "#E9B8A0",
    isUpcoming: true,
  },
  {
    id: "sch-2",
    recipient: "Sam",
    occasion: "Congratulations",
    when: "Mon 2 Nov, 18:00",
    channel: "Text",
    repeatYearly: false,
    color: "#BFC6E6",
    isUpcoming: true,
  },
  {
    id: "sch-3",
    recipient: "Aisha",
    occasion: "Thank you",
    when: "Fri 20 Nov, 10:30",
    channel: "Email",
    repeatYearly: false,
    color: "#BFD3C8",
    isUpcoming: true,
  },
  {
    id: "sch-4",
    recipient: "Dad",
    occasion: "Thinking of you",
    when: "Sent Sun 4 Oct, 08:00",
    channel: "Link",
    repeatYearly: false,
    color: "#F2C48D",
    isUpcoming: false,
  },
];

function ScheduledCards() {
  const [tab, setTab] = useState<"upcoming" | "sent">("upcoming");
  const [items, setItems] = useState<ScheduledItem[]>(defaultScheduled);

  function cancelItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Scheduled delivery cancelled.");
  }

  const filteredItems = items.filter((item) =>
    tab === "upcoming" ? item.isUpcoming : !item.isUpcoming,
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col bg-[#FBF5EE] text-[#2A1F22]">
      <AppHeader />
      {/* Header matching 6 Scheduled.png */}
      <header className="px-5 pt-4 pb-2">
        <h1 className="font-serif text-[30px] font-normal tracking-tight text-[#2A1F22]">
          Scheduled
        </h1>
        <p className="mt-1 text-sm text-[#6B5A5E]">
          Cards waiting to be delivered, and ones already sent.
        </p>
      </header>

      {/* Segmented Control: Upcoming vs Sent */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F3E6DA] p-1">
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={cn(
              "min-h-[46px] rounded-xl text-sm font-semibold transition-all",
              tab === "upcoming"
                ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)] font-bold"
                : "text-[#6B5A5E] hover:text-[#2A1F22]",
            )}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setTab("sent")}
            className={cn(
              "min-h-[46px] rounded-xl text-sm font-semibold transition-all",
              tab === "sent"
                ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)] font-bold"
                : "text-[#6B5A5E] hover:text-[#2A1F22]",
            )}
          >
            Sent
          </button>
        </div>
      </div>

      {/* Cards List */}
      <main className="flex-1 px-5 py-2 flex flex-col gap-3">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white p-3.5 shadow-sm transition hover:border-[#C9A9A0]"
          >
            <div className="flex items-center gap-3.5">
              {/* Card preview badge */}
              <div
                className="size-16 shrink-0 rounded-xl border border-[#E2D2C5] p-1 flex items-center justify-center shadow-inner"
                style={{ backgroundColor: item.color }}
              >
                <div className="size-full rounded-lg bg-white/40 flex items-center justify-center">
                  <span className="font-serif text-xs font-bold text-[#2A1F22]/70">
                    {item.recipient.slice(0, 1)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[#2A1F22]">{item.recipient}</div>
                <div className="text-sm text-[#6B5A5E]">{item.occasion}</div>
                <div className="mt-0.5 text-sm font-semibold text-[#2A1F22]">{item.when}</div>
              </div>
            </div>

            {/* Tags & Action Row */}
            <div className="flex items-center gap-2 pt-1 border-t border-[#F3E6DA]/80">
              <span className="inline-flex min-h-[28px] items-center rounded-full bg-[#F3E6DA] px-2.5 text-xs font-semibold text-[#2A1F22]">
                {item.channel}
              </span>
              {item.repeatYearly && (
                <span className="inline-flex min-h-[28px] items-center rounded-full bg-[#F3E6DA] px-2.5 text-xs font-semibold text-[#2A1F22]">
                  Every year
                </span>
              )}

              <div className="ml-auto flex items-center gap-3">
                <Link
                  to="/"
                  className="tap-safe text-sm font-semibold text-[#9E2B57] hover:underline"
                >
                  Edit
                </Link>
                {item.isUpcoming && (
                  <button
                    type="button"
                    onClick={() => cancelItem(item.id)}
                    className="tap-safe text-sm font-semibold text-[#A8261E] hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}

        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[#6B5A5E]">
            <Calendar className="size-10 text-[#C9A9A0] mb-3 stroke-[1.5]" />
            <h3 className="font-serif text-xl font-normal text-[#2A1F22]">No cards here yet</h3>
            <p className="mt-1 text-sm max-w-[260px]">
              {tab === "upcoming"
                ? "Cards you schedule ahead of time will show up here."
                : "Cards you've delivered will be archived here."}
            </p>
          </div>
        )}
      </main>

      {/* Action CTA matching 6 Scheduled.png */}
      <footer className="px-5 pt-3 pb-6">
        <Button
          asChild
          className="h-14 w-full rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_14px_rgba(158,43,87,0.25)]"
        >
          <Link to="/">
            <Plus className="size-5 mr-2" />
            Schedule a card
          </Link>
        </Button>
      </footer>
    </div>
  );
}
