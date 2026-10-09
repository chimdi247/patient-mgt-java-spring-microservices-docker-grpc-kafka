package com.pm.patientservice.metrics;

import com.pm.patientservice.repository.PatientRepository;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Business metrics exported through the OpenTelemetry API (the OTel Java agent supplies the SDK and exporter).
 *   pm_patients_current                                      - gauge from the database
 *   pm_patient_operations_total{operation,outcome}           - create|update|delete x success|conflict|not_found|error
 *   pm_billing_calls_total{outcome}                          - gRPC calls to billing-service
 *   pm_patient_events_published_total{outcome}               - Kafka events (topic "patient")
 */
@Component
public class PatientMetrics {

  private static final AttributeKey<String> OPERATION = AttributeKey.stringKey("operation");
  private static final AttributeKey<String> OUTCOME = AttributeKey.stringKey("outcome");

  private final LongCounter operations;
  private final LongCounter billingCalls;
  private final LongCounter events;

  public PatientMetrics(PatientRepository patientRepository) {
    Meter meter = GlobalOpenTelemetry.getMeter("pm.patient-service");
    operations = meter.counterBuilder("pm.patient.operations")
        .setDescription("Patient create/update/delete operations by outcome").build();
    billingCalls = meter.counterBuilder("pm.billing.calls")
        .setDescription("gRPC calls from patient-service to billing-service").build();
    events = meter.counterBuilder("pm.patient.events.published")
        .setDescription("Patient events published to Kafka").build();
    meter.gaugeBuilder("pm.patients.current").setDescription("Patients in the database").ofLongs()
        .buildWithCallback(m -> m.record(patientRepository.count()));
  }

  public void operation(String operation, String outcome) {
    operations.add(1, Attributes.of(OPERATION, operation, OUTCOME, outcome));
  }

  public void billingCall(String outcome) {
    billingCalls.add(1, Attributes.of(OUTCOME, outcome));
  }

  public void eventPublished(String outcome) {
    events.add(1, Attributes.of(OUTCOME, outcome));
  }
}
