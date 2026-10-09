package com.pm.analyticsservice.metrics;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import org.springframework.stereotype.Component;

/** pm_analytics_events_total{event_type,outcome} - patient events consumed from Kafka. */
@Component
public class AnalyticsMetrics {

  private static final AttributeKey<String> EVENT_TYPE = AttributeKey.stringKey("event_type");
  private static final AttributeKey<String> OUTCOME = AttributeKey.stringKey("outcome");
  private final LongCounter events;

  public AnalyticsMetrics() {
    this.events = GlobalOpenTelemetry.getMeter("pm.analytics-service")
        .counterBuilder("pm.analytics.events")
        .setDescription("Patient events consumed from Kafka").build();
  }

  public void consumed(String eventType, String outcome) {
    events.add(1, Attributes.of(EVENT_TYPE, eventType, OUTCOME, outcome));
  }
}
