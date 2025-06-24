#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <dataset_name> <dataset_path> <namespace>" >&2
  exit 1
fi

DATASET_NAME="$1"
DATASET_PATH="$2"
NAMESPACE="$3"

export HF_ENDPOINT="http://data-store.test/v1/hf"
export HF_TOKEN="dummy-unused-value"

# Use the namespace/dataset_name format for the repo
huggingface-cli repo create "$DATASET_NAME" --type dataset
huggingface-cli upload --repo-type dataset "$NAMESPACE/$DATASET_NAME" "$DATASET_PATH"

curl -X POST "http://nemo.test/v1/datasets" \
   -H 'accept: application/json' \
   -H 'Content-Type: application/json' \
   -d "{
      \"name\": \"$DATASET_NAME\",
      \"namespace\": \"$NAMESPACE\",
      \"description\": \"This is an example of a dataset\",
      \"files_url\": \"hf://datasets/$NAMESPACE/$DATASET_NAME\",
      \"project\": \"sample_project\"
   }" | jq