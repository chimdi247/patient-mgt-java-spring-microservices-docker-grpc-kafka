package com.pm.billingservice.grpc;

import billing.BillingRequest;
import billing.BillingResponse;
import billing.BillingServiceGrpc.BillingServiceImplBase;
import com.pm.billingservice.metrics.BillingMetrics;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@GrpcService
public class BillingGrpcService extends BillingServiceImplBase {

  private static final Logger log = LoggerFactory.getLogger(
      BillingGrpcService.class);

  private final BillingMetrics metrics;

  public BillingGrpcService(BillingMetrics metrics) {
    this.metrics = metrics;
  }

  @Override
  public void createBillingAccount(BillingRequest billingRequest,
      StreamObserver<BillingResponse> responseObserver) {

      log.info("createBillingAccount request received {}", billingRequest.toString());

      // Business logic - e.g save to database, perform calculates etc

      BillingResponse response = BillingResponse.newBuilder()
          .setAccountId("12345")
          .setStatus("ACTIVE")
          .build();

      metrics.accountCreated();
      responseObserver.onNext(response);
      responseObserver.onCompleted();
  }
}
