#!/bin/sh
# Creates the Kafka topics used by the platform (idempotent). Run by the one-shot `kafka-init` container.
set -e
BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}"
KT=/opt/kafka/bin/kafka-topics.sh

# "patient": PatientEvent protobuf messages, produced by patient-service, consumed by analytics-service
for topic in patient; do
  echo "creating topic: $topic"
  $KT --bootstrap-server "$BOOTSTRAP" --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1
done
echo "topics:"; $KT --bootstrap-server "$BOOTSTRAP" --list
