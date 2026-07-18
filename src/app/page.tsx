import { prisma } from "@/lib/prisma";
import { buildResults } from "@/lib/voteCounts";
import VoteButton from "./VoteButton";

export default async function Home() {
  const grouped = await prisma.vote.groupBy({
    by: ["site"],
    _count: { site: true },
  });
  const tally = grouped.map((g) => ({ site: g.site, count: g._count.site }));
  const results = buildResults(tally);
  const maxCount = Math.max(1, ...results.map((r) => r.count));

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">투표해주세요</h1>
      <p className="text-sm text-zinc-500">
        팀원 4명이 각자 만든 사이트예요. 링크로 들어가서 써보고, 제일
        좋았던 곳에 투표해주세요.
      </p>

      <ul className="flex flex-col gap-4">
        {results.map((site) => (
          <li
            key={site.id}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-indigo-600 underline underline-offset-2"
              >
                {site.name}
              </a>
              <VoteButton siteId={site.id} />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${(site.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-zinc-600">
                {site.count}표
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
