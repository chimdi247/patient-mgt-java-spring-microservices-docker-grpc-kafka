package com.pm.apigateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Validates the bearer token against the auth-service, forwards the caller's identity to the downstream
 * service (X-User-Email / X-User-Role) and enforces the one role rule of the platform: only ADMIN may DELETE.
 *
 * Fixes: an invalid token used to surface as HTTP 500 (the @RestControllerAdvice never applies to gateway
 * filters); it is now a clean 401, and an unreachable auth-service is a 503.
 */
@Component
public class JwtValidationGatewayFilterFactory extends
    AbstractGatewayFilterFactory<Object> {

  private final WebClient webClient;

  public JwtValidationGatewayFilterFactory(WebClient.Builder webClientBuilder,
      @Value("${auth.service.url}") String authServiceUrl) {
    this.webClient = webClientBuilder.baseUrl(authServiceUrl).build();
  }

  @Override
  public GatewayFilter apply(Object config) {
    return (exchange, chain) -> {
      String token =
          exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

      if (token == null || !token.startsWith("Bearer ")) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
      }

      return webClient.get()
          .uri("/validate")
          .header(HttpHeaders.AUTHORIZATION, token)
          .retrieve()
          .toBodilessEntity()
          .flatMap(response -> {
            String email = response.getHeaders().getFirst("X-User-Email");
            String role = response.getHeaders().getFirst("X-User-Role");

            if (HttpMethod.DELETE.equals(exchange.getRequest().getMethod())
                && !"ADMIN".equals(role)) {
              exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
              return exchange.getResponse().setComplete();
            }

            ServerHttpRequest request = exchange.getRequest().mutate()
                .headers(h -> {
                  h.remove("X-User-Email");   // never trust identity headers sent by the client
                  h.remove("X-User-Role");
                  if (email != null) h.set("X-User-Email", email);
                  if (role != null) h.set("X-User-Role", role);
                })
                .build();
            return chain.filter(exchange.mutate().request(request).build());
          })
          .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
          })
          .onErrorResume(WebClientRequestException.class, e -> {
            exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
            return exchange.getResponse().setComplete();
          });
    };
  }
}
