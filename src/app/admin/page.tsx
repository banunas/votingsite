import { prisma } from "@/lib/prisma";
import {
  buildSiteStats,
  buildVisitorFunnel,
  buildVisitorTable,
} from "@/lib/visitStats";

function formatDuration(ms: number): string {
  if (ms < 1000) return "1초 미만";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-lilac/20 bg-ink-2 p-5">
      <h2 className="mb-4 text-sm font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs font-medium text-lilac">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-hot-pink to-acid"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold text-foreground">
        {count}
      </span>
    </div>
  );
}

export default async function AdminDashboard() {
  const visits = await prisma.siteVisit.findMany({
    select: { visitorId: true, site: true, dwellMs: true },
  });

  const siteStats = buildSiteStats(visits);
  const funnel = buildVisitorFunnel(visits);
  const visitorTable = buildVisitorTable(visits)
    .sort((a, b) => b.distinctSiteCount - a.distinctSiteCount)
    .slice(0, 50);

  const funnelMax = Math.max(...funnel.map((f) => f.visitorCount), 1);
  const clickMax = Math.max(...siteStats.map((s) => s.clickCount), 1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          voting 방문 지표
        </h1>
        <p className="text-sm text-lilac">
          체류시간은 근사치예요 (탭이 안 보였다가 다시 보인 시간 기준)
        </p>
      </div>

      <ChartCard title="사이트별 클릭 수 / 체류시간">
        <div className="flex flex-col gap-4">
          {siteStats.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <BarRow label={s.name} count={s.clickCount} max={clickMax} />
              <p className="pl-[5.5rem] text-[11px] text-lilac/70">
                평균 {s.avgDwellMs !== null ? formatDuration(s.avgDwellMs) : "-"}
                {" · "}
                중앙값{" "}
                {s.medianDwellMs !== null
                  ? formatDuration(s.medianDwellMs)
                  : "-"}
                {s.nullDwellCount > 0 &&
                  ` · 미확인 ${s.nullDwellCount}건`}
              </p>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="방문자 퍼널 (몇 개 사이트를 클릭했는지)">
        <div className="flex flex-col gap-2">
          {funnel.map((f) => (
            <BarRow
              key={f.sitesVisited}
              label={`${f.sitesVisited}개`}
              count={f.visitorCount}
              max={funnelMax}
            />
          ))}
        </div>
      </ChartCard>

      <ChartCard title="방문자별 상세 (상위 50명)">
        {visitorTable.length === 0 ? (
          <p className="text-sm text-lilac/70">아직 방문 기록이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-lilac/70">
                  <th className="pb-2 pr-3 font-medium">방문자</th>
                  <th className="pb-2 pr-3 font-medium">방문 수</th>
                  <th className="pb-2 font-medium">사이트별 체류</th>
                </tr>
              </thead>
              <tbody>
                {visitorTable.map((v) => (
                  <tr key={v.visitorId} className="border-t border-lilac/10">
                    <td className="py-2 pr-3 font-mono text-foreground">
                      {v.visitorId.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-3 text-foreground">
                      {v.distinctSiteCount}/4
                    </td>
                    <td className="py-2 text-lilac">
                      {Object.entries(v.dwellBySite)
                        .map(
                          ([site, dwellMs]) =>
                            `${site}: ${dwellMs !== null ? formatDuration(dwellMs) : "-"}`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
