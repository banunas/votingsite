import { prisma } from "@/lib/prisma";
import { buildResults } from "@/lib/voteCounts";
import VoteButton from "./VoteButton";

const RANK_BADGE = ["👑", "🥈", "🥉", "💀"];

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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">
        투표해주세요 🙏🙇‍♂️🧎‍♂️🧎‍♂️
      </h1>
      <p className="text-sm text-zinc-500">
        뭐로 할지 결정못하겠어서 팀원 4명이 각자 하나씩 만들었어요 😁💪💪😻
        제일 마음에 드는 사이트 투표해주시면 최다 득표 받은 걸로
        발표하겠습니다 ^^ 🫰🫰🥵🧑‍🏫
      </p>

      <ul className="flex flex-col gap-4">
        {ranked.map((site, i) => {
          const isLeader = i === 0 && site.count > 0;
          const isLast =
            i === ranked.length - 1 &&
            site.count < leaderCount &&
            leaderCount > 0;
          const gap = leaderCount - site.count;

          return (
            <li
              key={site.id}
              className={`flex flex-col gap-3 rounded-2xl border-2 p-5 transition ${
                isLeader
                  ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-200/60"
                  : isLast
                    ? "border-zinc-200 bg-zinc-50 opacity-80"
                    : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">
                    {site.count > 0 ? (RANK_BADGE[i] ?? `${i + 1}위`) : `${i + 1}위`}
                  </span>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-bold text-indigo-600 underline underline-offset-2"
                  >
                    {site.name}
                  </a>
                </div>
                <VoteButton siteId={site.id} />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${
                      isLeader
                        ? "bg-gradient-to-r from-amber-400 to-orange-500"
                        : "bg-indigo-400"
                    }`}
                    style={{ width: `${(site.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-bold text-zinc-700">
                  {site.count}표
                </span>
              </div>

              {isLeader && (
                <p className="text-xs font-bold text-amber-600">
                  압도적 1위 👑 지금 못 따라옴
                </p>
              )}
              {!isLeader && gap > 0 && (
                <p className="text-xs font-medium text-zinc-400">
                  1위랑 {gap}표 차이... 힘내라
                </p>
              )}
              {isLast && (
                <p className="text-xs font-bold text-red-500">
                  꼴등이다 ㅋㅋㅋ 얼른 투표받아라
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
