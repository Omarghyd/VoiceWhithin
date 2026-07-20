import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicVoiceCard } from "@/lib/voice-card.functions";

const SITE = "https://voicewithin.app";

export const Route = createFileRoute("/v/$slug")({
  loader: async ({ params }) => {
    const card = await getPublicVoiceCard({ data: { slug: params.slug } });
    if (!card) throw notFound();
    return { card };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE}/v/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Voice card — Voice Within" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.card.displayName;
    const desc = loaderData.card.opening.slice(0, 155) || `${name}'s writing voice, captured.`;
    const title = `${name}'s writing voice — Voice Within`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <VoiceCardMissing />,
  notFoundComponent: () => <VoiceCardMissing />,
  component: VoiceCardPage,
});

function VoiceCardMissing() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground mb-6">
          Voice card
        </p>
        <h1 className="display text-3xl mb-6">Nothing here, or no longer here.</h1>
        <p className="text-muted-foreground leading-relaxed">
          The owner may have taken it down, or the link is wrong.
        </p>
        <Link
          to="/"
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          Find your own voice <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}

function VoiceCardPage() {
  const { card } = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-6 md:px-8 py-5 border-b border-border/60 flex items-center justify-between">
        <Link to="/" className="font-serif text-lg tracking-tight">Voice Within</Link>
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          Find your own →
        </Link>
      </header>

      <article className="mx-auto max-w-2xl px-6 md:px-8 py-20 md:py-28">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground mb-8">
          The writing voice of
        </p>
        <h1 className="display text-4xl md:text-5xl leading-[1.05] mb-10">
          {card.displayName}
        </h1>

        {card.opening && (
          <p className="font-serif italic text-2xl leading-snug text-balance mb-12">
            {card.opening}
          </p>
        )}

        {card.observations.length > 0 && (
          <section className="mb-14">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-5">
              How {card.displayName.split(" ")[0]} writes
            </p>
            <ul className="space-y-3">
              {card.observations.map((o: string, i: number) => (
                <li key={i} className="font-serif text-lg leading-relaxed">
                  · {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        {card.signaturePassage && (
          <section className="mb-14 rounded-2xl border border-foreground bg-accent/20 p-8">
            <p className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-4">
              In their own hand
            </p>
            <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap">
              {card.signaturePassage}
            </p>
          </section>
        )}

        <div className="mt-16 border-t border-border/60 pt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Every AI can write. None of them know how you write. Voice Within
            does.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 whitespace-nowrap"
          >
            Find your own voice <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    </main>
  );
}
