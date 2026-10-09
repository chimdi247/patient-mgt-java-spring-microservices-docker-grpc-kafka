package com.pm.billingservice.metrics;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.LongCounter;
import org.springframework.stereotype.Component;

/** pm_billing_accounts_created_total - billing accounts opened through the gRPC API. */
@Component
public class BillingMetrics {

  private final LongCounter accountsCreated;

  public BillingMetrics() {
    this.accountsCreated = GlobalOpenTelemetry.getMeter("pm.billing-service")
        .counterBuilder("pm.billing.accounts.created")
        .setDescription("Billing accounts created via gRPC").build();
  }

  public void accountCreated() {
    accountsCreated.add(1);
  }
}
