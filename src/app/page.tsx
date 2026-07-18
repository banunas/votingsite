import { prisma } from "@/lib/prisma";
import { buildResults } from "@/lib/voteCounts";
import VoteButton from "./VoteButton";
import AnimatedCount from "./AnimatedCount";
import CommentForm from "./CommentForm";

const RANK_BADGE = ["👑", "🥈", "🥉", "💀"];

const RANK_STYLE = [
  {
    border: "border-gold",
    bg: "bg-gradient-to-br from-[#3a2410] via-ink-2 to-ink-2",
    bar: "bg-gradient-to-r from-gold to-ember",
    glow: "animate-glow-pulse",
    text: "text-gold",
  },
  {
    border: "border-hot-pink/70",
    bg: "bg-ink-2",
    bar: "bg-gradient-to-r from-hot-pink to-hot-pink/70",
    glow: "",
    text: "text-hot-pink",
  },
  {
    border: "border-acid/60",
    bg: "bg-ink-2",
    bar: "bg-gradient-to-r from-acid to-acid/60",
    glow: "",
    text: "text-acid",
  },
  {
    border: "border-roast/70",
    bg: "bg-ink-2/60",
    bar: "bg-gradient-to-r from-roast to-roast/60",
    glow: "",
    text: "text-roast",
  },
];

export default async function Home() {
  const grouped = await prisma.vote.groupBy({
    by: ["site"],
    _count: { site: true },
  });
  const tally = grouped.map((g) => ({ site: g.site, count: g._count.site }));
  const results = buildResults(tally);

  const ranked = [...results].sort((a, b) => b.count - a.count);
  const leaderCount = ranked[0]?.count ?? 0;
  const maxCount = Math.max(1, leaderCount);
  const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col gap-7 overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-hot-pink/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-acid/10 blur-3xl"
      />

      <header className="relative flex flex-col gap-3 animate-rise">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-roast opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-roast" />
          </span>
          <p className="text-xs font-bold tracking-[0.2em] text-roast uppercase">
            실시간 순위 공개
          </p>
        </div>

        <h1 className="font-display text-4xl leading-tight text-foreground [text-wrap:balance]">
          투표해주세요 🙏🙇‍♂️🧎‍♂️🧎‍♂️
        </h1>

        <p className="text-sm text-lilac">
          뭐로 할지 결정못하겠어서 팀원 4명이 각자 하나씩 만들었어요 😁💪💪😻
          제일 마음에 드는 사이트 투표해주시면 최다 득표 받은 걸로
          발표하겠습니다 ^^ 🫰🫰🥵🧑‍🏫
        </p>

        {totalVotes > 0 && (
          <p className="text-sm font-bold text-foreground">
            지금까지 <AnimatedCount value={totalVotes} />표 모임 🔥
          </p>
        )}
      </header>

      <ul className="relative flex flex-col gap-4">
        {ranked.map((site, i) => {
          const style = RANK_STYLE[i] ?? RANK_STYLE[3];
          const isLeader = i === 0 && site.count > 0;
          const isLast =
            i === ranked.length - 1 &&
            site.count < leaderCount &&
            leaderCount > 0;
          const gap = leaderCount - site.count;

          return (
            <li
              key={site.id}
              style={{ animationDelay: `${i * 90}ms` }}
              className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 transition animate-rise ${style.border} ${style.bg} ${style.glow}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-block text-2xl ${isLeader ? "animate-float" : ""} ${isLast ? "animate-shake" : ""}`}
                  >
                    {site.count > 0
                      ? (RANK_BADGE[i] ?? `${i + 1}위`)
                      : `${i + 1}위`}
                  </span>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`truncate font-bold underline decoration-2 underline-offset-4 ${style.text}`}
                  >
                    {site.name}
                  </a>
                </div>
                <VoteButton siteId={site.id} />
              </div>

              <p className="text-xs font-medium text-foreground/70">
                {site.description}
              </p>

              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${style.bar}`}
                    style={{ width: `${(site.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                  {site.count}표
                </span>
              </div>

              {isLeader && (
                <p className="text-xs font-bold text-gold">
                  압도적 1위 👑 지금 못 따라옴
                </p>
              )}
              {!isLeader && gap > 0 && !isLast && (
                <p className="text-xs font-medium text-lilac">
                  1위랑 {gap}표 차이... 힘내라
                </p>
              )}
              {isLast && (
                <p className="text-xs font-bold text-roast">
                  꼴등이다 ㅋㅋㅋ 얼른 투표받아라 (1위랑 {gap}표 차이)
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <section className="relative flex flex-col gap-3">
        <h2 className="font-display text-xl text-foreground">
          익명 피드백 💬
        </h2>
        <p className="-mt-2 text-xs text-lilac">
          등록한 피드백은 수정하거나 지울 수 없어요. 신중하게 남겨주세요.
        </p>

        <CommentForm />

        {comments.length === 0 ? (
          <p className="text-sm text-lilac/70">
            아직 피드백이 없어요. 첫 댓글의 주인공이 되어보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-lilac/20 bg-ink-2 px-4 py-3"
              >
                <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                  {comment.body}
                </p>
                <p className="mt-1 font-mono text-[11px] text-lilac/60">
                  {comment.createdAt.toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
