# Regenerates dashboards/pm-overview.json  (run from observability/grafana:  python3 generate_dashboard.py)
# Optional: the JSON is the source of truth - you can also edit the dashboard in the Grafana UI (allowUiUpdates=true).
import json

PROM = {"type": "prometheus", "uid": "prometheus"}
LOKI = {"type": "loki", "uid": "loki"}
TEMPO = {"type": "tempo", "uid": "tempo"}

panels = []
_id = 0
_y = 0

def nid():
    global _id; _id += 1; return _id

def row(title):
    global _y
    panels.append({"id": nid(), "type": "row", "title": title, "collapsed": False,
                   "gridPos": {"h": 1, "w": 24, "x": 0, "y": _y}, "panels": []})
    _y += 1

def tgt(expr, legend="", ref="A", instant=False, ds=PROM):
    t = {"refId": ref, "datasource": ds, "expr": expr, "legendFormat": legend}
    if instant: t.update({"instant": True, "range": False})
    return t

def stat(title, expr, x, w=4, h=4, unit="short", thresholds=None, desc="", decimals=None, mappings=None, color_mode="background", legend=""):
    global _y
    th = thresholds or [{"color": "green", "value": None}]
    fc = {"unit": unit, "thresholds": {"mode": "absolute", "steps": th}, "color": {"mode": "thresholds"}}
    if decimals is not None: fc["decimals"] = decimals
    if mappings: fc["mappings"] = mappings
    panels.append({"id": nid(), "type": "stat", "title": title, "description": desc, "datasource": PROM,
        "gridPos": {"h": h, "w": w, "x": x, "y": _y},
        "targets": [tgt(expr, legend, instant=True)],
        "fieldConfig": {"defaults": fc, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "colorMode": color_mode, "graphMode": "none", "textMode": "value", "justifyMode": "center"}})

def ts(title, targets, x, w=12, h=8, unit="short", desc="", stack=False, thresholds=None, minv=None, maxv=None, fill=12, bars=False):
    global _y
    custom = {"drawStyle": "bars" if bars else "line", "lineWidth": 2, "fillOpacity": fill, "showPoints": "never",
              "spanNulls": True, "stacking": {"mode": "normal" if stack else "none", "group": "A"}}
    if thresholds:
        custom["thresholdsStyle"] = {"mode": "line+area"}
    fc = {"unit": unit, "custom": custom}
    if thresholds: fc["thresholds"] = {"mode": "absolute", "steps": thresholds}
    if minv is not None: fc["min"] = minv
    if maxv is not None: fc["max"] = maxv
    panels.append({"id": nid(), "type": "timeseries", "title": title, "description": desc, "datasource": PROM,
        "gridPos": {"h": h, "w": w, "x": x, "y": _y}, "targets": targets,
        "fieldConfig": {"defaults": fc, "overrides": []},
        "options": {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["mean", "max", "lastNotNull"]},
                    "tooltip": {"mode": "multi", "sort": "desc"}}})

def gauge(title, expr, x, w=4, h=5, unit="percent", steps=None, minv=0, maxv=100, desc=""):
    panels.append({"id": nid(), "type": "gauge", "title": title, "description": desc, "datasource": PROM,
        "gridPos": {"h": h, "w": w, "x": x, "y": _y},
        "targets": [tgt(expr, "{{service}}", instant=True)],
        "fieldConfig": {"defaults": {"unit": unit, "min": minv, "max": maxv,
            "thresholds": {"mode": "absolute", "steps": steps or [{"color": "green", "value": None}, {"color": "orange", "value": 50}, {"color": "red", "value": 80}]}}, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"]}, "showThresholdMarkers": True}})

def nxt(h):
    global _y; _y += h

# --------------------------------------------------------------------------- selectors
SVC = 'service_name=~"$service"'
NOACT = 'http_route!~"/actuator.*"'
REQ = f'http_server_request_duration_seconds_count{{{SVC},{NOACT}}}'
BUCKET = f'http_server_request_duration_seconds_bucket{{{SVC},{NOACT}}}'

def rate_all(r="$__rate_interval"):  return f'sum(rate({REQ}[{r}]))'
def rate_cls(rx, r="$__rate_interval"):
    return f'sum(rate(http_server_request_duration_seconds_count{{{SVC},{NOACT},http_response_status_code=~"{rx}"}}[{r}]))'

# container selectors (cAdvisor)
C_CPU = ('100 * sum by (service) (label_replace(rate(container_cpu_usage_seconds_total{name!=""}[2m]), "service", "$1", "name", "(.*)")) '
         '/ sum by (service) (label_replace(container_spec_cpu_quota{name!=""} / container_spec_cpu_period{name!=""}, "service", "$1", "name", "(.*)") > 0)')
C_MEM = ('100 * sum by (service) (label_replace(container_memory_working_set_bytes{name!=""}, "service", "$1", "name", "(.*)")) '
         '/ sum by (service) (label_replace(container_spec_memory_limit_bytes{name!=""}, "service", "$1", "name", "(.*)") > 0)')
N_CPU = '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'
N_MEM = '100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))'

G, O, R = {"color": "green", "value": None}, {"color": "orange", "value": 50}, {"color": "red", "value": 80}
RG = [{"color": "red", "value": None}, {"color": "orange", "value": 99}, {"color": "green", "value": 99.9}]

# =========================================================================== 1. at a glance
row("At a glance")
stat("Services up", 'sum(probe_success{job="blackbox-health"}) or vector(0)', 0, 3,
     thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 4}, {"color": "green", "value": 5}],
     desc="Health-endpoint probes currently succeeding (5 expected: api-gateway, auth-service, patient-service, billing-service, analytics-service).")
stat("Total patients", 'sum(pm_patients_current) or vector(0)', 3, 3, thresholds=[{"color": "blue", "value": None}], desc="Patients in the database (patient-service).")
stat("Total users", 'sum(pm_users_current) or vector(0)', 6, 3, thresholds=[{"color": "blue", "value": None}], desc="Staff accounts that can sign in (auth-service).")
stat("Billing accounts", 'sum(pm_billing_accounts_created_total) or vector(0)', 9, 3, thresholds=[{"color": "purple", "value": None}], desc="Billing accounts opened via gRPC since billing-service started.")
stat("Successful HTTP requests", f'sum(increase({REQ[:-1]},http_response_status_code=~"[23].."}}[$__range])) or vector(0)', 12, 3,
     thresholds=[{"color": "green", "value": None}], desc="2xx/3xx responses in the selected time range (actuator excluded).")
stat("Failed HTTP requests", f'sum(increase({REQ[:-1]},http_response_status_code=~"[45].."}}[$__range])) or vector(0)', 15, 3,
     thresholds=[{"color": "green", "value": None}, {"color": "orange", "value": 1}, {"color": "red", "value": 50}], desc="4xx/5xx responses in the selected time range.")
stat("Server errors (5xx)", f'sum(increase({REQ[:-1]},http_response_status_code=~"5.."}}[$__range])) or vector(0)', 18, 3,
     thresholds=[{"color": "green", "value": None}, {"color": "red", "value": 1}])
stat("p95 latency", f'histogram_quantile(0.95, sum by (le) (rate({BUCKET}[$__rate_interval])))', 21, 3, unit="s", decimals=3,
     thresholds=[{"color": "green", "value": None}, {"color": "orange", "value": 0.5}, {"color": "red", "value": 1}])
nxt(4)

# =========================================================================== 2. uptime
row("Uptime & availability")
stat("Uptime (selected range)", 'avg(avg_over_time(probe_success{job="blackbox-health"}[$__range])) * 100', 0, 4, unit="percent", decimals=3,
     thresholds=RG, desc="Share of successful /actuator/health probes across all services.")
ts("Service health (1 = up)", [tgt('probe_success{job="blackbox-health"}', "{{service_name}}")], 4, 10, 6, minv=0, maxv=1.1, fill=20,
   desc="Blackbox probe of every /actuator/health endpoint.")
ts("JVM uptime", [tgt('max by (service_name) (jvm_uptime_seconds)', "{{service_name}}")], 14, 10, 6, unit="s")
nxt(6)

# =========================================================================== 3. SLI / SLO
row("SLI / SLO  (targets: availability 99.9 %, success rate 99 %, latency < 500 ms for 95 % of requests)")
stat("Availability SLI (30m)", 'avg(avg_over_time(probe_success{job="blackbox-health"}[30m])) * 100', 0, 4, unit="percent", decimals=3, thresholds=RG,
     desc="SLO: 99.9 %")
stat("Success-rate SLI", f'100 * (1 - (sum(rate({REQ[:-1]},http_response_status_code=~"5.."}}[$__range])) or vector(0)) / {rate_all("$__range")})', 4, 4, unit="percent", decimals=3,
     thresholds=RG, desc="Share of requests that did NOT fail with 5xx. SLO: 99 %")
stat("Latency SLI  (< 500 ms)", f'100 * sum(rate(http_server_request_duration_seconds_bucket{{{SVC},{NOACT},le="0.5"}}[$__range])) / {rate_all("$__range")}', 8, 4,
     unit="percent", decimals=2, thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 90}, {"color": "green", "value": 95}],
     desc="Share of requests served in under 500 ms. SLO: 95 %")
stat("Error budget left (availability)", '100 * clamp_min(1 - ((1 - avg(avg_over_time(probe_success{job="blackbox-health"}[$__range]))) / 0.001), 0)', 12, 4,
     unit="percent", decimals=1, thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 25}, {"color": "green", "value": 60}],
     desc="1 - (observed downtime / allowed downtime of a 99.9 % SLO).")
stat("Error budget left (success rate)", f'100 * clamp_min(1 - (((sum(rate({REQ[:-1]},http_response_status_code=~"5.."}}[$__range])) or vector(0)) / {rate_all("$__range")}) / 0.01), 0)', 16, 4,
     unit="percent", decimals=1, thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 25}, {"color": "green", "value": 60}],
     desc="1 - (observed 5xx ratio / allowed 1 % for a 99 % SLO).")
stat("Apdex-style satisfaction", f'100 * (sum(rate(http_server_request_duration_seconds_bucket{{{SVC},{NOACT},le="0.25"}}[$__range])) + (sum(rate(http_server_request_duration_seconds_bucket{{{SVC},{NOACT},le=~"1|1.0"}}[$__range])) - sum(rate(http_server_request_duration_seconds_bucket{{{SVC},{NOACT},le="0.25"}}[$__range]))) / 2) / {rate_all("$__range")}', 20, 4,
     unit="percent", decimals=1, thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 70}, {"color": "green", "value": 85}],
     desc="Satisfied < 250 ms, tolerating < 1 s (counts half), frustrated above.")
nxt(4)
ts("Success rate by service (non-5xx, 5m)", [tgt(
    f'100 * (1 - (sum by (service_name) (rate(http_server_request_duration_seconds_count{{{SVC},{NOACT},http_response_status_code=~"5.."}}[5m])) or (0 * sum by (service_name) (rate({REQ}[5m])))) / sum by (service_name) (rate({REQ}[5m])))',
    "{{service_name}}")], 0, 12, 7, unit="percent", minv=90, maxv=100, thresholds=[{"color": "red", "value": None}, {"color": "green", "value": 99}])
ts("Latency SLI by service (% < 500 ms, 5m)", [tgt(
    f'100 * sum by (service_name) (rate(http_server_request_duration_seconds_bucket{{{SVC},{NOACT},le="0.5"}}[5m])) / sum by (service_name) (rate({REQ}[5m]))',
    "{{service_name}}")], 12, 12, 7, unit="percent", minv=0, maxv=100, thresholds=[{"color": "red", "value": None}, {"color": "green", "value": 95}])
nxt(7)

# =========================================================================== 4. RED per service
row("Traffic, errors & latency (RED) per service")
ts("Request rate by service", [tgt(f'sum by (service_name) (rate({REQ}[$__rate_interval]))', "{{service_name}}")], 0, 8, 8, unit="reqps", stack=True)
ts("Requests by status class", [
    tgt(rate_cls("2.."), "2xx", "A"), tgt(rate_cls("3.."), "3xx", "B"), tgt(rate_cls("4.."), "4xx", "C"), tgt(rate_cls("5.."), "5xx", "D")],
   8, 8, 8, unit="reqps", stack=True)
ts("Error rate % (4xx + 5xx)", [tgt(
    f'100 * sum by (service_name) (rate(http_server_request_duration_seconds_count{{{SVC},{NOACT},http_response_status_code=~"[45].."}}[$__rate_interval])) / sum by (service_name) (rate({REQ}[$__rate_interval]))',
    "{{service_name}}")], 16, 8, 8, unit="percent", minv=0)
nxt(8)
ts("Latency p50 / p95 / p99 (all selected services)", [
    tgt(f'histogram_quantile(0.50, sum by (le) (rate({BUCKET}[$__rate_interval])))', "p50", "A"),
    tgt(f'histogram_quantile(0.95, sum by (le) (rate({BUCKET}[$__rate_interval])))', "p95", "B"),
    tgt(f'histogram_quantile(0.99, sum by (le) (rate({BUCKET}[$__rate_interval])))', "p99", "C")], 0, 8, 8, unit="s")
ts("p95 latency by service", [tgt(f'histogram_quantile(0.95, sum by (le, service_name) (rate({BUCKET}[$__rate_interval])))', "{{service_name}}")], 8, 8, 8, unit="s")
ts("Slowest routes (p95)", [tgt(f'topk(8, histogram_quantile(0.95, sum by (le, service_name, http_route) (rate({BUCKET}[$__rate_interval]))))', "{{service_name}} {{http_route}}")], 16, 8, 8, unit="s")
nxt(8)

# =========================================================================== 5. business KPIs
row("Business KPIs")
OPS = 'pm_patient_operations_total'
stat("Total patients", 'sum(pm_patients_current) or vector(0)', 0, 3, thresholds=[{"color": "blue", "value": None}])
stat("Patients registered", f'sum(increase({OPS}{{operation="create",outcome="success"}}[$__range])) or vector(0)', 3, 3, thresholds=[{"color": "green", "value": None}], desc="Successful creates in the selected time range.")
stat("Patients updated", f'sum(increase({OPS}{{operation="update",outcome="success"}}[$__range])) or vector(0)', 6, 3, thresholds=[{"color": "blue", "value": None}])
stat("Patients deleted", f'sum(increase({OPS}{{operation="delete",outcome="success"}}[$__range])) or vector(0)', 9, 3, thresholds=[{"color": "blue", "value": None}])
stat("Rejected / failed operations", f'sum(increase({OPS}{{outcome!="success"}}[$__range])) or vector(0)', 12, 3,
     thresholds=[{"color": "green", "value": None}, {"color": "orange", "value": 1}, {"color": "red", "value": 20}],
     desc="Duplicate e-mails (conflict), unknown ids (not_found) and errors (e.g. billing-service down).")
stat("Billing accounts opened", 'sum(increase(pm_billing_accounts_created_total[$__range])) or vector(0)', 15, 3, thresholds=[{"color": "purple", "value": None}])
stat("Analytics events consumed", 'sum(increase(pm_analytics_events_total{outcome="success"}[$__range])) or vector(0)', 18, 3, thresholds=[{"color": "purple", "value": None}],
     desc="Patient events processed by analytics-service from the Kafka topic 'patient'.")
stat("Login success ratio", '100 * sum(increase(pm_logins_total{outcome="success"}[$__range])) / sum(increase(pm_logins_total[$__range]))', 21, 3,
     unit="percent", decimals=1, thresholds=[{"color": "red", "value": None}, {"color": "orange", "value": 80}, {"color": "green", "value": 95}])
nxt(4)
ts("Patients over time", [tgt('sum(pm_patients_current)', "patients", "A"), tgt('sum(pm_users_current)', "users", "B")], 0, 8, 7)
ts("Patient operations / min", [tgt(f'sum by (operation, outcome) (rate({OPS}[$__rate_interval])) * 60', "{{operation}} {{outcome}}")], 8, 8, 7, bars=True, stack=True, fill=70)
ts("Logins / min by outcome", [tgt('sum by (outcome) (rate(pm_logins_total[$__rate_interval])) * 60', "{{outcome}}")], 16, 8, 7, bars=True, stack=True, fill=70)
nxt(7)
ts("Registration pipeline / min (patient -> billing gRPC -> Kafka -> analytics)", [
    tgt(f'sum(rate({OPS}{{operation="create",outcome="success"}}[$__rate_interval])) * 60', "patients created", "A"),
    tgt('sum(rate(pm_billing_accounts_created_total[$__rate_interval])) * 60', "billing accounts opened", "B"),
    tgt('sum(rate(pm_patient_events_published_total{outcome="success"}[$__rate_interval])) * 60', "Kafka events published", "C"),
    tgt('sum(rate(pm_analytics_events_total{outcome="success"}[$__rate_interval])) * 60', "analytics events consumed", "D")], 0, 12, 7,
   desc="All four lines should move together; a gap shows where the pipeline is losing or delaying work.")
ts("Downstream calls by outcome / min", [
    tgt('sum by (outcome) (rate(pm_billing_calls_total[$__rate_interval])) * 60', "billing gRPC {{outcome}}", "A"),
    tgt('sum by (outcome) (rate(pm_patient_events_published_total[$__rate_interval])) * 60', "Kafka publish {{outcome}}", "B"),
    tgt('sum by (outcome) (rate(pm_analytics_events_total[$__rate_interval])) * 60', "analytics {{outcome}}", "C")], 12, 12, 7, bars=True, stack=True, fill=70)
nxt(7)

# =========================================================================== 6. resources
row("Container & node utilisation  (alerts fire above 50 %)")
gauge("Node CPU", N_CPU, 0, 4, 6, desc="Host CPU utilisation (node-exporter).")
gauge("Node memory", N_MEM, 4, 4, 6, desc="Host memory utilisation (node-exporter).")
stat("Node disk used", '100 * (1 - sum(node_filesystem_avail_bytes{mountpoint="/"}) / sum(node_filesystem_size_bytes{mountpoint="/"}))', 8, 4, h=6, unit="percent", decimals=1,
     thresholds=[G, {"color": "orange", "value": 70}, {"color": "red", "value": 85}], color_mode="value")
stat("Containers above 50 % CPU", f'count(({C_CPU}) > 50) or vector(0)', 12, 6, h=6, thresholds=[G, {"color": "red", "value": 1}], desc="Containers currently breaching the CPU alert threshold.")
stat("Containers above 50 % memory", f'count(({C_MEM}) > 50) or vector(0)', 18, 6, h=6, thresholds=[G, {"color": "red", "value": 1}], desc="Containers currently breaching the memory alert threshold.")
nxt(6)
ts("Container CPU % of limit", [tgt(C_CPU, "{{service}}")], 0, 12, 8, unit="percent", thresholds=[G, O], minv=0, desc="Alert: > 50 % for 2 min")
ts("Container memory % of limit", [tgt(C_MEM, "{{service}}")], 12, 12, 8, unit="percent", thresholds=[G, O], minv=0, desc="Alert: > 50 % for 2 min")
nxt(8)
ts("Container memory (working set)", [tgt('sum by (name) (container_memory_working_set_bytes{name!=""})', "{{name}}")], 0, 8, 8, unit="bytes")
ts("Container network I/O", [
    tgt('sum by (name) (rate(container_network_receive_bytes_total{name!=""}[$__rate_interval]))', "rx {{name}}", "A"),
    tgt('-sum by (name) (rate(container_network_transmit_bytes_total{name!=""}[$__rate_interval]))', "tx {{name}}", "B")], 8, 8, 8, unit="Bps")
ts("Node CPU by mode", [tgt('sum by (mode) (rate(node_cpu_seconds_total{mode!="idle"}[$__rate_interval])) / scalar(count(node_cpu_seconds_total{mode="idle"})) * 100', "{{mode}}")], 16, 8, 8, unit="percent", stack=True, minv=0)
nxt(8)
ts("Node CPU % / memory %", [tgt(N_CPU, "CPU", "A"), tgt(N_MEM, "Memory", "B")], 0, 12, 7, unit="percent", thresholds=[G, O], minv=0, maxv=100)
ts("Node load average", [tgt('node_load1', "1m", "A"), tgt('node_load5', "5m", "B"), tgt('node_load15', "15m", "C")], 12, 12, 7)
nxt(7)

# =========================================================================== 7. JVM
row("JVM (per service)")
ts("Heap used", [tgt('sum by (service_name) (jvm_memory_used_bytes{jvm_memory_type="heap", service_name=~"$service"})', "{{service_name}}")], 0, 8, 7, unit="bytes")
ts("JVM CPU utilisation", [tgt('max by (service_name) (jvm_cpu_recent_utilization_ratio{service_name=~"$service"}) * 100', "{{service_name}}")], 8, 8, 7, unit="percent", minv=0)
ts("Live threads", [tgt('sum by (service_name) (jvm_thread_count{service_name=~"$service"})', "{{service_name}}")], 16, 8, 7)
nxt(7)

# =========================================================================== 8. logs + traces
row("Logs & traces  (open a log line, then click “Open trace in Tempo” to see the full trace with its spans)")
global_y = _y
panels.append({"id": nid(), "type": "logs", "title": "Logs  ($service)", "datasource": LOKI,
    "gridPos": {"h": 12, "w": 24, "x": 0, "y": _y},
    "targets": [{"refId": "A", "datasource": LOKI, "expr": '{service_name=~"$service"} |~ "(?i)$search"', "queryType": "range"}],
    "options": {"showTime": True, "wrapLogMessage": True, "enableLogDetails": True, "sortOrder": "Descending", "dedupStrategy": "none", "prettifyLogMessage": False}})
nxt(12)
panels.append({"id": nid(), "type": "table", "title": "Recent error traces  (click a trace id to open it)", "datasource": TEMPO,
    "gridPos": {"h": 10, "w": 14, "x": 0, "y": _y},
    "targets": [{"refId": "A", "datasource": TEMPO, "queryType": "traceql", "limit": 30, "tableType": "traces",
                 "query": '{ resource.service.name =~ "$service" && status = error } | select(span.http.route)'}],
    "fieldConfig": {"defaults": {}, "overrides": []}, "options": {"showHeader": True}})
panels.append({"id": nid(), "type": "table", "title": "Slowest traces (> 500 ms)", "datasource": TEMPO,
    "gridPos": {"h": 10, "w": 10, "x": 14, "y": _y},
    "targets": [{"refId": "A", "datasource": TEMPO, "queryType": "traceql", "limit": 30, "tableType": "traces",
                 "query": '{ resource.service.name =~ "$service" && duration > 500ms }'}],
    "fieldConfig": {"defaults": {}, "overrides": []}, "options": {"showHeader": True}})
nxt(10)
panels.append({"id": nid(), "type": "nodeGraph", "title": "Service map (from traces)", "datasource": PROM,
    "gridPos": {"h": 10, "w": 24, "x": 0, "y": _y},
    "targets": [{"refId": "A", "datasource": TEMPO, "queryType": "serviceMap"}],
    "options": {}})
panels[-1]["datasource"] = TEMPO
nxt(10)

dash = {
    "uid": "pm-overview", "title": "Patient Management - Platform overview", "tags": ["patient-mgmt", "slo", "sli", "otel"],
    "timezone": "browser", "schemaVersion": 39, "version": 1, "editable": True, "graphTooltip": 1,
    "refresh": "15s", "time": {"from": "now-1h", "to": "now"},
    "links": [
        {"type": "dashboards", "title": "Patient Management dashboards", "tags": ["patient-mgmt"], "asDropdown": True, "includeVars": False, "keepTime": True},
        {"title": "Kafka UI", "url": "http://localhost:8090", "type": "link", "icon": "external link", "targetBlank": True},
        {"title": "Mailpit", "url": "http://localhost:8025", "type": "link", "icon": "external link", "targetBlank": True},
        {"title": "Alert rules", "url": "/alerting/list", "type": "link", "icon": "bolt"},
    ],
    "templating": {"list": [
        {"name": "service", "label": "Service", "type": "query", "datasource": PROM, "includeAll": True, "multi": True,
         "allValue": ".+", "refresh": 2, "sort": 1,
         "query": {"query": 'label_values(http_server_request_duration_seconds_count, service_name)', "refId": "v1"},
         "current": {"selected": True, "text": "All", "value": "$__all"}},
        {"name": "search", "label": "Log filter", "type": "textbox", "query": "", "current": {"text": "", "value": ""}},
    ]},
    "annotations": {"list": [{"name": "Alerts", "type": "dashboard", "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                              "enable": True, "iconColor": "red", "builtIn": 1}]},
    "panels": [p for p in panels if p],
}
json.dump(dash, open("dashboards/pm-overview.json", "w"), indent=1)
print("panels:", len(dash["panels"]))
