package com.pm.authservice.metrics;

import com.pm.authservice.repository.UserRepository;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Business metrics exported through the OpenTelemetry API (the OTel Java agent supplies the SDK and exporter).
 *   pm_logins_total{outcome="success|bad_password|unknown_user"}
 *   pm_users_current                                  - gauge, read from the database at every export
 */
@Component
public class AuthMetrics {

  private static final AttributeKey<String> OUTCOME = AttributeKey.stringKey("outcome");
  private final LongCounter logins;

  public AuthMetrics(UserRepository userRepository) {
    Meter meter = GlobalOpenTelemetry.getMeter("pm.auth-service");
    this.logins = meter.counterBuilder("pm.logins").setDescription("Login attempts").build();
    meter.gaugeBuilder("pm.users.current").setDescription("Registered users").ofLongs()
        .buildWithCallback(m -> m.record(userRepository.count()));
  }

  public void login(String outcome) {
    logins.add(1, Attributes.of(OUTCOME, outcome));
  }
}
