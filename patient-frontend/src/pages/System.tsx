import { Activity, BarChart3, Database, ExternalLink, FileJson, Gauge, Inbox, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useFetch } from "@/lib/hooks";

const env = import.meta.env as Record<string, string | undefined>;
const grafana = env.VITE_GRAFANA_URL || "http://localhost:3001";
const tools = [
  { name: "Grafana dashboards", desc: "Uptime, latency, error rates, SLOs, business KPIs, logs and traces for every service.", href: `${grafana}/d/pm-overview`, icon: BarChart3 },
  { name: "PostgreSQL dashboard", desc: "Connections, transactions, cache hit ratio, locks, table sizes and rows.", href: `${grafana}/d/pm-postgres`, icon: Database },
  { name: "Kafka dashboard", desc: "Topic throughput and consumer-group lag for the patient events.", href: `${grafana}/d/pm-kafka`, icon: MessagesSquare },
  { name: "Load-test results (k6)", desc: "Live results of smoke, load, stress, spike and soak runs.", href: `${grafana}/d/pm-k6`, icon: Gauge },
  { name: "Kafka UI", desc: "Browse the 'patient' topic and the analytics-service consumer group.", href: env.VITE_KAFKA_UI_URL || "http://localhost:8090", icon: MessagesSquare },
  { name: "Alert rules", desc: "CPU and memory above 50 %, Postgres and Kafka health.", href: `${grafana}/alerting/list`, icon: Activity },
  { name: "Mailpit", desc: "E-mails sent by Grafana alerts.", href: env.VITE_MAILPIT_URL || "http://localhost:8025", icon: Inbox },
  { name: "Patient API (OpenAPI)", desc: "OpenAPI document of the patient-service, served through the gateway.", href: "/api-docs/patients", icon: FileJson },
];

export default function System() {
  const health = useFetch(async () => {
    const r = await fetch("/gateway-health");
    return (await r.json()) as { status: string };
  });
  const up = health.data?.status === "UP";

  return (
    <>
      <PageHeader title="System" description="Operational tools for the platform." actions={
        <Badge variant={health.loading ? "secondary" : up ? "success" : "destructive"}>API gateway {health.loading ? "checking…" : up ? "up" : "unreachable"}</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map(({ name, desc, href, icon: Icon }) => (
          <a key={name} href={href} target="_blank" rel="noreferrer" className="group">
            <Card className="flex h-full items-start gap-4 p-5 transition-colors group-hover:border-accent">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-accent"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">{name}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></p>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </>
  );
}
