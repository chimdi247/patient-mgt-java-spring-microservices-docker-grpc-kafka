# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- stage 1: build
FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /app

# resolve dependencies first so they are cached between builds (BuildKit cache mount keeps ~/.m2)
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline -B

# build the executable jar (also generates the protobuf / gRPC classes). Tests need a database and Kafka,
# so they are skipped here - run them with: mvn test
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn clean package -DskipTests -B

# ---------------------------------------------------------------- stage 2: runtime
FROM eclipse-temurin:21-jre
ARG OTEL_AGENT_VERSION=2.24.0
WORKDIR /app

# curl is used by the docker-compose healthchecks
RUN if ! command -v curl >/dev/null 2>&1; then \
      apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*; \
    fi

# OpenTelemetry Java agent: zero-code instrumentation of HTTP, gRPC, JDBC, Kafka, logs and JVM metrics.
# Configured entirely with OTEL_* environment variables (see docker-compose.yml); OTEL_JAVAAGENT_ENABLED=false disables it.
ADD https://repo1.maven.org/maven2/io/opentelemetry/javaagent/opentelemetry-javaagent/${OTEL_AGENT_VERSION}/opentelemetry-javaagent-${OTEL_AGENT_VERSION}.jar /opt/otel/opentelemetry-javaagent.jar

COPY --from=builder /app/target/*.jar app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=50.0 -javaagent:/opt/otel/opentelemetry-javaagent.jar"

EXPOSE 4001
EXPOSE 9001

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
