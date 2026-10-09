import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, CalendarRange, Cake, RefreshCw, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ageOf, displayName, formatDate, initials, parseDate } from "@/lib/format";
import { useFetch } from "@/lib/hooks";

const GROUPS = [
  { label: "0 - 17", test: (a: number) => a < 18 },
  { label: "18 - 34", test: (a: number) => a >= 18 && a < 35 },
  { label: "35 - 49", test: (a: number) => a >= 35 && a < 50 },
  { label: "50 - 64", test: (a: number) => a >= 50 && a < 65 },
  { label: "65 +", test: (a: number) => a >= 65 },
];

export default function Dashboard() {
  const { session } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.listPatients());
  const patients = data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const regs = patients.map((p) => ({ p, d: parseDate(p.registeredDate) }));
    const thisMonth = regs.filter((r) => r.d && r.d.getFullYear() === now.getFullYear() && r.d.getMonth() === now.getMonth()).length;
    const thisYear = regs.filter((r) => r.d && r.d.getFullYear() === now.getFullYear()).length;
    const avgAge = patients.length ? Math.round(patients.reduce((s, p) => s + ageOf(p.dateOfBirth), 0) / patients.length) : 0;

    // registrations per month, last 12 months
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-GB", { month: "short" }), count: 0 };
    });
    regs.forEach((r) => { if (r.d) { const m = months.find((x) => x.key === `${r.d!.getFullYear()}-${r.d!.getMonth()}`); if (m) m.count++; } });

    const ages = GROUPS.map((g) => ({ label: g.label, count: patients.filter((p) => g.test(ageOf(p.dateOfBirth))).length }));
    const recent = [...patients].sort((a, b) => (b.registeredDate ?? "").localeCompare(a.registeredDate ?? "")).slice(0, 6);
    return { thisMonth, thisYear, avgAge, months, ages, recent };
  }, [patients]);

  const maxMonth = Math.max(1, ...stats.months.map((m) => m.count));
  const maxAge = Math.max(1, ...stats.ages.map((a) => a.count));

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Good to see you, {displayName(session?.email)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">A snapshot of your patient list.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void reload(true)} aria-label="Refresh"><RefreshCw /></Button>
          <Button asChild variant="accent"><Link to="/patients?new=1"><CalendarPlus />Register patient</Link></Button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total patients" value={patients.length} icon={Users} loading={loading} />
        <StatCard label="Registered this month" value={stats.thisMonth} icon={CalendarPlus} loading={loading} />
        <StatCard label="Registered this year" value={stats.thisYear} icon={CalendarRange} loading={loading} />
        <StatCard label="Average age" value={stats.avgAge} icon={Cake} loading={loading} hint="years" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Registrations, last 12 months</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52" /> : (
              <div className="flex h-52 items-end gap-2" role="img" aria-label="Bar chart of patient registrations per month">
                {stats.months.map((m) => (
                  <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="tnum text-xs font-semibold text-muted-foreground">{m.count || ""}</span>
                    <div className="w-full rounded-t-md bg-accent/80 transition-all" style={{ height: `${Math.max((m.count / maxMonth) * 100, m.count ? 6 : 2)}%`, opacity: m.count ? 1 : 0.25 }} />
                    <span className="text-[11px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Age groups</CardTitle></CardHeader>
          <CardContent className="space-y-3.5">
            {loading ? <Skeleton className="h-52" /> : stats.ages.map((a) => (
              <div key={a.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{a.label}</span><span className="tnum text-muted-foreground">{a.count}</span></div>
                <div className="h-2.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(a.count / maxAge) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recently registered</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/patients">All patients</Link></Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-5"><Skeleton className="h-40" /></div> : stats.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No patients yet. Register the first one.</p>
          ) : (
            <ul className="divide-y">
              {stats.recent.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">{initials(p.name)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
                  <span className="tnum text-xs text-muted-foreground">{formatDate(p.registeredDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
