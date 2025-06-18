#!/usr/bin/env bash

set -euo pipefail

log() { echo -e "\033[1;32m[INFO]\033[0m $*"; }

log "Deleting Minikube cluster..."
minikube delete
log "Minikube cluster deleted successfully."
log "Deleting files..."
rm -rf ./nemo-microservices-helm-chart
rm -rf ./nemo-microservices-helm-chart*.tgz
log "Files deleted successfully."
