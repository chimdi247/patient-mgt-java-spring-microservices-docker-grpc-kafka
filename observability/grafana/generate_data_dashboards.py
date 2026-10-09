# Regenerates the PostgreSQL, Kafka and k6 dashboards in dashboards/
# (run from observability/grafana:  python3 generate_data_dashboards.py)
import json

PROM = {"type": "prometheus", "uid": "prometheus"}
G, O, R = {"color": "green", "value": None}, {"color": "orange", "value": 50}, {"color": "red", "value": 80}
BLUE = [{"color": "blue", "value": None}]


class Board:
    def __init__(self, uid, title, tags, variables):
        self.uid, self.title, self.tags, self.vars = uid, title, tags, variables
        self.panels, self.y, self._id = [], 0, 0

    def _nid(self):
        self._id += 1
        return self._id

    def row(self, title):
        self.panels.append({"id": self._nid(), "type": "row", "title": title, "collapsed": False,
                            "gridPos": {"h": 1, "w": 24, "x": 0, "y": self.y}, "panels": []})
        self.y += 1

    def nxt(self, h):
        self.y += h

    @staticmethod
    def tgt(expr, legend="", ref="A", instant=False):
        t = {"refId": ref, "datasource": PROM, "expr": expr, "legendFormat": legend}
        if instant:
            t.update({"instant": True, "range": False})
        return t

    def stat(self, title, expr, x, w=4, h=4, unit="short", steps=None, desc="", decimals=None):
        fc = {"unit": unit, "thresholds": {"mode": "absolute", "steps": steps or BLUE}, "color": {"mode": "thresholds"}}
        if decimals is not None:
            fc["decimals"] = decimals
        self.panels.append({"id": self._nid(), "type": "stat", "title": title, "description": desc, "datasource": PROM,
            "gridPos": {"h": h, "w": w, "x": x, "y": self.y}, "targets": [self.tgt(expr, instant=True)],
            "fieldConfig": {"defaults": fc, "overrides": []},
            "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                        "colorMode": "background", "graphMode": "none", "textMode": "value", "justifyMode": "center"}})

    def ts(self, title, targets, x, w=12, h=8, unit="short", desc="", stack=False, steps=None, minv=None, maxv=None, bars=False, fill=12):
        custom = {"drawStyle": "bars" if bars else "line", "lineWidth": 2, "fillOpacity": fill, "showPoints": "never",
                  "spanNulls": True, "stacking": {"mode": "normal" if stack else "none", "group": "A"}}
        fc = {"unit": unit, "custom": custom}
        if steps:
            custom["thresholdsStyle"] = {"mode": "line+area"}
            fc["thresholds"] = {"mode": "absolute", "steps": steps}
        if minv is not None: fc["min"] = minv
        if maxv is not None: fc["max"] = maxv
        self.panels.append({"id": self._nid(), "type": "timeseries", "title": title, "description": desc, "datasource": PROM,
            "gridPos": {"h": h, "w": w, "x": x, "y": self.y}, "targets": targets,
            "fieldConfig": {"defaults": fc, "overrides": []},
            "options": {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["mean", "max", "lastNotNull"]},
                        "tooltip": {"mode": "multi", "sort": "desc"}}})

    def table(self, title, expr, x, w=12, h=8, desc=""):
        self.panels.append({"id": self._nid(), "type": "table", "title": title, "description": desc, "datasource": PROM,
            "gridPos": {"h": h, "w": w, "x": x, "y": self.y},
            "targets": [{**self.tgt(expr, instant=True), "format": "table"}],
            "transformations": [{"id": "organize", "options": {"excludeByName": {"Time": True, "__name__": True, "job": True, "instance": True, "cluster": True}}}],
            "fieldConfig": {"defaults": {}, "overrides": []}, "options": {"showHeader": True, "sortBy": [{"displayName": "Value", "desc": True}]}})

    def save(self, path, refresh="15s", frm="now-1h", extra_links=None):
        dash = {
            "uid": self.uid, "title": self.title, "tags": self.tags, "timezone": "browser", "schemaVersion": 39, "version": 1,
            "editable": True, "graphTooltip": 1, "refresh": refresh, "time": {"from": frm, "to": "now"},
            "links": [{"type": "dashboards", "title": "Patient Management dashboards", "tags": ["patient-mgmt"], "asDropdown": True,
                       "includeVars": False, "keepTime": True}] + (extra_links or []),
            "templating": {"list": self.vars},
            "annotations": {"list": [{"name": "Alerts", "type": "dashboard", "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                                      "enable": True, "iconColor": "red", "builtIn": 1}]},
            "panels": self.panels,
        }
        json.dump(dash, open(path, "w"), indent=1)
        print(path, len(self.panels), "panels")


def qvar(name, label, query, multi=True, include_all=True, default_all=True):
    return {"name": name, "label": label, "type": "query", "datasource": PROM, "includeAll": include_all, "multi": multi,
            "allValue": ".+", "refresh": 2, "sort": 1, "query": {"query": query, "refId": f"v-{name}"},
            "current": {"selected": True, "text": "All", "value": "$__all"} if default_all else {}}


# container CPU / memory for a compose container name (cAdvisor)
def cont_cpu(rx):  return f'100 * sum by (name) (rate(container_cpu_usage_seconds_total{{name=~"{rx}"}}[2m])) / sum by (name) (container_spec_cpu_quota{{name=~"{rx}"}} / container_spec_cpu_period{{name=~"{rx}"}} > 0)'
def cont_cpu_cores(rx): return f'sum by (name) (rate(container_cpu_usage_seconds_total{{name=~"{rx}"}}[$__rate_interval]))'
def cont_mem(rx):  return f'sum by (name) (container_memory_working_set_bytes{{name=~"{rx}"}})'


# ============================================================================= PostgreSQL
D = 'datname=~"$db"'
APP_DBS = 'datname=~"auth_db|patient_db"'
b = Board("pm-postgres", "Patient Management - PostgreSQL", ["patient-mgmt", "postgres", "database"],
          [qvar("db", "Database", 'label_values(pg_stat_database_numbackends{datname=~"auth_db|patient_db"}, datname)')])

b.row("Health")
b.stat("Postgres up", 'pg_up', 0, 3, steps=[{"color": "red", "value": None}, {"color": "green", "value": 1}],
       desc="1 when postgres-exporter can query the server.")
b.stat("Uptime", 'time() - pg_postmaster_start_time_seconds', 3, 3, unit="s", decimals=0)
b.stat("Connections", f'sum(pg_stat_database_numbackends{{{D}}})', 6, 3, steps=[G, {"color": "orange", "value": 60}, {"color": "red", "value": 80}],
       desc="Open backends on the selected databases (max_connections is 100 - see docker-compose.yml).")
b.stat("Connection usage", f'100 * sum(pg_stat_database_numbackends) / 100', 9, 3, unit="percent", decimals=1,
       steps=[G, {"color": "orange", "value": 60}, {"color": "red", "value": 80}], desc="All databases vs max_connections=100.")
b.stat("Cache hit ratio", f'100 * sum(rate(pg_stat_database_blks_hit{{{D}}}[$__range])) / (sum(rate(pg_stat_database_blks_hit{{{D}}}[$__range])) + sum(rate(pg_stat_database_blks_read{{{D}}}[$__range])))', 12, 3,
       unit="percent", decimals=2, steps=[{"color": "red", "value": None}, {"color": "orange", "value": 90}, {"color": "green", "value": 99}],
       desc="Share of block reads served from shared buffers. Healthy OLTP workloads are > 99 %.")
b.stat("Commits / s", f'sum(rate(pg_stat_database_xact_commit{{{D}}}[$__rate_interval]))', 15, 3, unit="ops", decimals=1)
b.stat("Rollbacks (range)", f'sum(increase(pg_stat_database_xact_rollback{{{D}}}[$__range]))', 18, 3,
       steps=[G, {"color": "orange", "value": 1}, {"color": "red", "value": 50}])
b.stat("Deadlocks (range)", f'sum(increase(pg_stat_database_deadlocks{{{D}}}[$__range]))', 21, 3,
       steps=[G, {"color": "red", "value": 1}])
b.nxt(4)

b.row("Connections, transactions & throughput")
b.ts("Connections by database", [b.tgt(f'sum by (datname) (pg_stat_database_numbackends{{{D}}})', "{{datname}}")], 0, 8, 7, stack=True)
b.ts("Transactions / s", [
    b.tgt(f'sum by (datname) (rate(pg_stat_database_xact_commit{{{D}}}[$__rate_interval]))', "commit {{datname}}", "A"),
    b.tgt(f'sum by (datname) (rate(pg_stat_database_xact_rollback{{{D}}}[$__rate_interval]))', "rollback {{datname}}", "B")], 8, 8, 7, unit="ops")
b.ts("Rows written / s", [
    b.tgt(f'sum by (datname) (rate(pg_stat_database_tup_inserted{{{D}}}[$__rate_interval]))', "insert {{datname}}", "A"),
    b.tgt(f'sum by (datname) (rate(pg_stat_database_tup_updated{{{D}}}[$__rate_interval]))', "update {{datname}}", "B"),
    b.tgt(f'sum by (datname) (rate(pg_stat_database_tup_deleted{{{D}}}[$__rate_interval]))', "delete {{datname}}", "C")], 16, 8, 7, unit="ops")
b.nxt(7)
b.ts("Rows read / s (fetched vs returned)", [
    b.tgt(f'sum by (datname) (rate(pg_stat_database_tup_fetched{{{D}}}[$__rate_interval]))', "fetched {{datname}}", "A"),
    b.tgt(f'sum by (datname) (rate(pg_stat_database_tup_returned{{{D}}}[$__rate_interval]))', "returned {{datname}}", "B")], 0, 8, 7, unit="ops",
    desc="returned >> fetched usually means sequential scans.")
b.ts("Cache hit ratio by database", [b.tgt(
    f'100 * sum by (datname) (rate(pg_stat_database_blks_hit{{{D}}}[$__rate_interval])) / (sum by (datname) (rate(pg_stat_database_blks_hit{{{D}}}[$__rate_interval])) + sum by (datname) (rate(pg_stat_database_blks_read{{{D}}}[$__rate_interval])))',
    "{{datname}}")], 8, 8, 7, unit="percent", minv=0, maxv=100, steps=[{"color": "red", "value": None}, {"color": "green", "value": 95}])
b.ts("Locks by mode", [b.tgt(f'sum by (mode) (pg_locks_count{{{D}}})', "{{mode}}")], 16, 8, 7, stack=True)
b.nxt(7)

b.row("Storage & tables")
b.ts("Database size", [b.tgt(f'pg_database_size_bytes{{{D}}}', "{{datname}}")], 0, 8, 7, unit="bytes")
b.ts("Rows per table (live tuples)", [b.tgt(f'sum by (datname, relname) (pg_stat_user_tables_n_live_tup{{{D}}})', "{{datname}}.{{relname}}")], 8, 8, 7,
     desc="users and patient: the business tables.")
b.ts("Dead tuples (vacuum pressure)", [b.tgt(f'sum by (datname, relname) (pg_stat_user_tables_n_dead_tup{{{D}}})', "{{datname}}.{{relname}}")], 16, 8, 7)
b.nxt(7)
b.ts("Sequential vs index scans / s", [
    b.tgt(f'sum by (relname) (rate(pg_stat_user_tables_seq_scan{{{D}}}[$__rate_interval]))', "seq {{relname}}", "A"),
    b.tgt(f'sum by (relname) (rate(pg_stat_user_tables_idx_scan{{{D}}}[$__rate_interval]))', "idx {{relname}}", "B")], 0, 8, 7, unit="ops")
b.ts("Temp files & deadlocks", [
    b.tgt(f'sum by (datname) (rate(pg_stat_database_temp_bytes{{{D}}}[$__rate_interval]))', "temp bytes/s {{datname}}", "A"),
    b.tgt(f'sum by (datname) (increase(pg_stat_database_deadlocks{{{D}}}[$__rate_interval]))', "deadlocks {{datname}}", "B"),
    b.tgt(f'sum by (datname) (increase(pg_stat_database_conflicts{{{D}}}[$__rate_interval]))', "conflicts {{datname}}", "C")], 8, 8, 7)
b.ts("Long-running transactions", [b.tgt('sum(pg_long_running_transactions)', "count", "A")], 16, 8, 7,
     desc="Transactions open for a long time block vacuum and hold locks.")
b.nxt(7)

b.row("Postgres container (cAdvisor)")
b.ts("CPU % of limit / cores used", [b.tgt(cont_cpu_cores("postgres"), "cores used", "A")], 0, 8, 7, unit="short", desc="Cores used (the postgres container has no CPU limit).")
b.ts("Memory (working set)", [b.tgt(cont_mem("postgres"), "{{name}}")], 8, 8, 7, unit="bytes")
b.ts("Network & disk I/O", [
    b.tgt('sum(rate(container_network_receive_bytes_total{name="postgres"}[$__rate_interval]))', "net rx", "A"),
    b.tgt('sum(rate(container_network_transmit_bytes_total{name="postgres"}[$__rate_interval]))', "net tx", "B"),
    b.tgt('sum(rate(container_fs_writes_bytes_total{name="postgres"}[$__rate_interval]))', "disk write", "C"),
    b.tgt('sum(rate(container_fs_reads_bytes_total{name="postgres"}[$__rate_interval]))', "disk read", "D")], 16, 8, 7, unit="Bps")
b.nxt(7)
b.row("Business tables (from the app's own metrics)")
b.ts("Patients and users", [
    b.tgt('sum(pm_patients_current)', "patients", "A"),
    b.tgt('sum(pm_users_current)', "users", "B")], 0, 12, 7)
b.ts("Patient writes / min (create, update, delete)", [
    b.tgt('sum by (operation) (rate(pm_patient_operations_total{outcome="success"}[$__rate_interval])) * 60', "{{operation}}")], 12, 12, 7, bars=True, stack=True, fill=70)
b.nxt(7)
b.save("dashboards/pm-postgres.json")


# ============================================================================= Kafka
T = 'topic=~"$topic", topic!~"__.*"'
GRP = 'consumergroup=~"$group"'
k = Board("pm-kafka", "Patient Management - Kafka", ["patient-mgmt", "kafka", "messaging"],
          [qvar("topic", "Topic", 'label_values(kafka_topic_partitions{topic!~"__.*"}, topic)'),
           qvar("group", "Consumer group", 'label_values(kafka_consumergroup_lag, consumergroup)')])

k.row("Cluster")
k.stat("Brokers", 'max(kafka_brokers)', 0, 3, steps=[{"color": "red", "value": None}, {"color": "green", "value": 1}])
k.stat("Topics", 'count(count by (topic) (kafka_topic_partitions{topic!~"__.*"}))', 3, 3)
k.stat("Partitions", 'sum(kafka_topic_partitions{topic!~"__.*"})', 6, 3)
k.stat("Under-replicated", 'sum(kafka_topic_partition_under_replicated_partition{topic!~"__.*"}) or vector(0)', 9, 3,
       steps=[G, {"color": "red", "value": 1}], desc="Partitions whose in-sync replica set is smaller than the replica set.")
k.stat("Consumer lag (total)", f'sum(kafka_consumergroup_lag{{{GRP}}}) or vector(0)', 12, 3,
       steps=[G, {"color": "orange", "value": 50}, {"color": "red", "value": 200}],
       desc="Messages produced but not yet processed by the selected consumer groups. Alert fires above 100 for 2 minutes.")
k.stat("Consumer members", f'sum(kafka_consumergroup_members{{{GRP}}}) or vector(0)', 15, 3,
       steps=[{"color": "red", "value": None}, {"color": "green", "value": 1}], desc="Active consumers; 0 means nobody is processing.")
k.stat("Produced / s", f'sum(rate(kafka_topic_partition_current_offset{{{T}}}[$__rate_interval]))', 18, 3, unit="ops", decimals=2)
k.stat("Consumed / s", f'sum(rate(kafka_consumergroup_current_offset{{{GRP}, topic=~"$topic"}}[$__rate_interval]))', 21, 3, unit="ops", decimals=2)
k.nxt(4)

k.row("Throughput & lag")
k.ts("Messages produced / s by topic", [k.tgt(f'sum by (topic) (rate(kafka_topic_partition_current_offset{{{T}}}[$__rate_interval]))', "{{topic}}")], 0, 8, 7, unit="ops", stack=True)
k.ts("Messages consumed / s by group & topic", [k.tgt(f'sum by (consumergroup, topic) (rate(kafka_consumergroup_current_offset{{{GRP}, topic=~"$topic"}}[$__rate_interval]))', "{{consumergroup}} / {{topic}}")], 8, 8, 7, unit="ops")
k.ts("Consumer lag by group & topic", [k.tgt(f'sum by (consumergroup, topic) (kafka_consumergroup_lag{{{GRP}, topic=~"$topic"}})', "{{consumergroup}} / {{topic}}")], 16, 8, 7,
     steps=[G, {"color": "orange", "value": 50}, {"color": "red", "value": 100}], minv=0,
     desc="Rising lag = consumers are slower than producers (e.g. analytics events are processed late).")
k.nxt(7)
k.ts("Total messages written per topic", [k.tgt(f'sum by (topic) (kafka_topic_partition_current_offset{{{T}}})', "{{topic}}")], 0, 8, 7,
     desc="Cumulative offsets: how many messages each topic has ever received.")
k.ts("Messages retained per topic", [k.tgt(f'sum by (topic) (kafka_topic_partition_current_offset{{{T}}} - kafka_topic_partition_oldest_offset{{{T}}})', "{{topic}}")], 8, 8, 7)
k.ts("Lag per partition", [k.tgt(f'kafka_consumergroup_lag{{{GRP}, topic=~"$topic"}}', "{{consumergroup}} {{topic}}[{{partition}}]")], 16, 8, 7, minv=0)
k.nxt(7)

k.row("Replication & layout")
k.ts("In-sync replicas per partition", [k.tgt(f'min by (topic) (kafka_topic_partition_in_sync_replica{{{T}}})', "ISR {{topic}}", "A"),
                                        k.tgt(f'min by (topic) (kafka_topic_partition_replicas{{{T}}})', "replicas {{topic}}", "B")], 0, 8, 7)
k.table("Topics: partitions", f'sum by (topic) (kafka_topic_partitions{{{T}}})', 8, 8, 7)
k.table("Consumer groups: lag by topic (now)", f'sum by (consumergroup, topic) (kafka_consumergroup_lag{{{GRP}, topic=~"$topic"}})', 16, 8, 7)
k.nxt(7)

k.row("Application view: producer vs consumer of the 'patient' topic")
k.ts("Patients created / s -> events published / s -> events consumed / s", [
    k.tgt('sum(rate(pm_patient_operations_total{operation="create", outcome="success"}[$__rate_interval]))', "patients created (patient-service)", "A"),
    k.tgt('sum(rate(pm_patient_events_published_total{outcome="success"}[$__rate_interval]))', "events published to Kafka", "B"),
    k.tgt('sum(rate(kafka_consumergroup_current_offset{consumergroup="analytics-service", topic="patient"}[$__rate_interval]))', "offsets committed by analytics-service", "C"),
    k.tgt('sum(rate(pm_analytics_events_total{outcome="success"}[$__rate_interval]))', "events processed (analytics-service)", "D")], 0, 24, 8, unit="ops",
    desc="The four lines should overlap. A gap between 'published' and 'processed' is consumer lag; 'created' above 'published' means events are being dropped.")
k.nxt(8)

k.row("Kafka & consumer containers (cAdvisor)")
k.ts("Kafka CPU (cores)", [k.tgt(cont_cpu_cores("kafka|kafka-ui|kafka-exporter"), "{{name}}")], 0, 8, 7)
k.ts("Kafka memory (working set)", [k.tgt(cont_mem("kafka|kafka-ui|kafka-exporter"), "{{name}}")], 8, 8, 7, unit="bytes")
k.ts("Broker network & disk I/O", [
    k.tgt('sum(rate(container_network_receive_bytes_total{name="kafka"}[$__rate_interval]))', "net in", "A"),
    k.tgt('sum(rate(container_network_transmit_bytes_total{name="kafka"}[$__rate_interval]))', "net out", "B"),
    k.tgt('sum(rate(container_fs_writes_bytes_total{name="kafka"}[$__rate_interval]))', "disk write", "C")], 16, 8, 7, unit="Bps")
k.nxt(7)
k.save("dashboards/pm-kafka.json")


# ============================================================================= k6
S = 'testid=~"$testid", ep!="setup"'
t = Board("pm-k6", "Patient Management - Performance tests (k6)", ["patient-mgmt", "k6", "performance"],
          [{"name": "testid", "label": "Test run", "type": "query", "datasource": PROM, "includeAll": True, "multi": True, "allValue": ".+",
            "refresh": 2, "sort": 2, "query": {"query": "label_values(k6_vus, testid)", "refId": "v-testid"},
            "current": {"selected": True, "text": "All", "value": "$__all"}}])

t.row("Result of the selected run(s)")
t.stat("Peak VUs", f'max(max_over_time(k6_vus{{{S}}}[$__range]))', 0, 3, desc="Peak concurrent virtual users.")
t.stat("Requests", f'sum(max_over_time(k6_http_reqs_total{{{S}}}[$__range]))', 3, 3)
t.stat("Avg req/s", f'sum(rate(k6_http_reqs_total{{{S}}}[$__range]))', 6, 3, unit="reqps", decimals=1)
t.stat("Error rate", f'100 * (sum(increase(k6_http_reqs_total{{{S}, expected_response="false"}}[$__range])) or vector(0)) / sum(increase(k6_http_reqs_total{{{S}}}[$__range]))', 9, 3, unit="percent", decimals=2,
       steps=[G, {"color": "orange", "value": 1}, {"color": "red", "value": 5}], desc="Share of requests whose status was not expected by the script (negative tests declare their 401/403/400 as expected).")
t.stat("Checks passed", f'100 * avg(avg_over_time(k6_checks_rate{{{S}}}[$__range]))', 12, 3, unit="percent", decimals=2,
       steps=[{"color": "red", "value": None}, {"color": "orange", "value": 95}, {"color": "green", "value": 99}])
t.stat("p95 (worst endpoint)", f'max(avg_over_time(k6_http_req_duration_p95{{{S}}}[$__range]))', 15, 3, unit="ms", decimals=0,
       steps=[G, {"color": "orange", "value": 500}, {"color": "red", "value": 1000}])
t.stat("p99 (worst endpoint)", f'max(avg_over_time(k6_http_req_duration_p99{{{S}}}[$__range]))', 18, 3, unit="ms", decimals=0,
       steps=[G, {"color": "orange", "value": 1000}, {"color": "red", "value": 2000}])
t.stat("Iterations", f'sum(max_over_time(k6_iterations_total{{{S}}}[$__range]))', 21, 3)
t.nxt(4)
t.stat("Kafka drain time (burst test)", f'max(max_over_time(k6_kafka_drain_seconds_max{{testid=~"$testid"}}[$__range]))', 0, 6, 4, unit="s", decimals=1,
       steps=[G, {"color": "orange", "value": 30}, {"color": "red", "value": 120}],
       desc="kafka-burst.js: seconds until the analytics consumer had caught up (lag = 0) after the burst ended.")
t.stat("Create-patient p95", f'max(max_over_time(k6_http_req_duration_p95{{testid=~"$testid", ep="create"}}[$__range]))', 6, 6, 4, unit="ms", decimals=0,
       steps=[G, {"color": "orange", "value": 1000}, {"color": "red", "value": 2000}],
       desc="POST /api/patients: database write + gRPC call to billing-service + Kafka publish.")
t.nxt(4)

t.row("Client-side view (what k6 measured)")
t.ts("Virtual users", [t.tgt(f'max by (testid) (k6_vus{{{S}}})', "VUs {{testid}}")], 0, 8, 7)
t.ts("Requests / s", [t.tgt(f'sum by (testid) (rate(k6_http_reqs_total{{{S}}}[$__rate_interval]))', "{{testid}}")], 8, 8, 7, unit="reqps")
t.ts("Error rate %", [t.tgt(f'100 * (sum by (testid) (rate(k6_http_reqs_total{{{S}, expected_response="false"}}[$__rate_interval])) or (0 * sum by (testid) (rate(k6_http_reqs_total{{{S}}}[$__rate_interval])))) / sum by (testid) (rate(k6_http_reqs_total{{{S}}}[$__rate_interval]))', "{{testid}}")], 16, 8, 7, unit="percent", minv=0,
     steps=[G, {"color": "red", "value": 5}])
t.nxt(7)
t.ts("Response time (avg / worst-endpoint percentiles)", [
    t.tgt(f'avg(k6_http_req_duration_avg{{{S}}})', "avg", "A"),
    t.tgt(f'max(k6_http_req_duration_p90{{{S}}})', "p90", "B"),
    t.tgt(f'max(k6_http_req_duration_p95{{{S}}})', "p95", "C"),
    t.tgt(f'max(k6_http_req_duration_p99{{{S}}})', "p99", "D"),
    t.tgt(f'max(k6_http_req_duration_max{{{S}}})', "max", "E")], 0, 12, 8, unit="ms")
t.ts("p95 by request name", [t.tgt(f'max by (name) (k6_http_req_duration_p95{{{S}, name!=""}})', "{{name}}")], 12, 12, 8, unit="ms")
t.nxt(8)
t.ts("Time to first byte (waiting) p95 & connecting", [
    t.tgt(f'max(k6_http_req_waiting_p95{{{S}}})', "waiting p95", "A"),
    t.tgt(f'max(k6_http_req_connecting_p95{{{S}}})', "connecting p95", "B"),
    t.tgt(f'max(k6_http_req_blocked_p95{{{S}}})', "blocked p95", "C")], 0, 8, 7, unit="ms")
t.ts("Create-patient latency (DB + gRPC + Kafka)", [
    t.tgt(f'avg(k6_http_req_duration_avg{{{S}, ep="create"}})', "avg", "A"),
    t.tgt(f'max(k6_http_req_duration_p95{{{S}, ep="create"}})', "p95", "B"),
    t.tgt(f'max(k6_http_req_duration_p99{{{S}, ep="create"}})', "p99", "C")], 8, 8, 7, unit="ms",
     desc="POST /api/patients touches the database, billing-service (gRPC) and Kafka in one request.")
t.ts("Data sent / received", [
    t.tgt(f'sum(rate(k6_data_sent_total{{{S}}}[$__rate_interval]))', "sent", "A"),
    t.tgt(f'sum(rate(k6_data_received_total{{{S}}}[$__rate_interval]))', "received", "B")], 16, 8, 7, unit="Bps")
t.nxt(7)

t.row("Server-side view during the test (what the platform experienced)")
t.ts("Server p95 latency by service", [t.tgt('histogram_quantile(0.95, sum by (le, service_name) (rate(http_server_request_duration_seconds_bucket{http_route!~"/actuator.*"}[$__rate_interval])))', "{{service_name}}")], 0, 8, 7, unit="s")
t.ts("Server 5xx / s by service", [t.tgt('sum by (service_name) (rate(http_server_request_duration_seconds_count{http_response_status_code=~"5..", http_route!~"/actuator.*"}[$__rate_interval]))', "{{service_name}}")], 8, 8, 7, unit="reqps", minv=0)
t.ts("Container CPU % of limit", [t.tgt('100 * sum by (name) (rate(container_cpu_usage_seconds_total{name=~".*-service|api-gateway"}[2m])) / sum by (name) (container_spec_cpu_quota{name=~".*-service|api-gateway"} / container_spec_cpu_period{name=~".*-service|api-gateway"} > 0)', "{{name}}")], 16, 8, 7, unit="percent", steps=[G, O, R], minv=0)
t.nxt(7)
t.ts("Postgres connections & commits/s", [
    t.tgt('sum(pg_stat_database_numbackends{datname=~"auth_db|patient_db"})', "connections", "A"),
    t.tgt('sum(rate(pg_stat_database_xact_commit{datname=~"auth_db|patient_db"}[$__rate_interval]))', "commits/s", "B")], 0, 8, 7)
t.ts("Kafka consumer lag", [t.tgt('sum by (consumergroup) (kafka_consumergroup_lag)', "{{consumergroup}}")], 8, 8, 7, minv=0)
t.ts("JVM heap used", [t.tgt('sum by (service_name) (jvm_memory_used_bytes{jvm_memory_type="heap"})', "{{service_name}}")], 16, 8, 7, unit="bytes")
t.nxt(7)
t.save("dashboards/pm-k6.json", refresh="5s", frm="now-30m")
