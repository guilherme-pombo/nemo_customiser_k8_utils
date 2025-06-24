#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <model_id>" >&2
  exit 1
fi

MODEL_ID="$1"

export EVALUATOR_TARGET="default/$(curl -s -X POST \
  "http://nemo.test/v1/evaluation/targets" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
        "type": "model",
        "model": {
          "api_endpoint": {
            "url": "http://nemo-nim-proxy:8000/v1/completions",
            "model_id": "'"$MODEL_ID"'"
          }
        }
      }' | jq -r '.id')"

export EVALUATOR_CONFIG="default/$(curl -s -X POST \
  "http://nemo.test/v1/evaluation/configs" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "custom",
    "params": { "parallelism": 4 },
    "tasks": {
      "my-custom-task": {
        "type": "completion",
        "params": {
          "template": {
            "prompt": "{{prompt}}",
            "max_tokens": 20,
            "temperature": 0.7,
            "top_p": 0.9
          }
        },
        "dataset": {
          "files_url": "hf://datasets/default/sample-basic-test/testing/testing.jsonl"
        },
        "metrics": {
          "bleu": {
            "type": "bleu",
            "params": { "references": ["{{ideal_response}}"] }
          },
          "string-check": {
            "type": "string-check",
            "params": {
              "check": ["{{ideal_response | trim}}", "equals", "{{output_text | trim}}"]
            }
          }
        }
      }
    }
  }' | jq -r '.id')"

export EVALUATION_JOB_ID="$(curl -s -X POST \
  "http://nemo.test/v1/evaluation/jobs" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d "{
    \"target\": \"${EVALUATOR_TARGET}\",
    \"config\": \"${EVALUATOR_CONFIG}\"
  }" | jq -r '.id')"


# Keep looping until we get some evaluation results
API="http://nemo.test/v1/evaluation/jobs/${EVALUATION_JOB_ID}/results"

while :; do
  resp=$(curl -s -H 'accept: application/json' "$API")
  if jq -e '.tasks[].metrics | length > 0' <<< "$resp" > /dev/null 2>&1; then
    echo "$resp" | jq
    break
  else
    echo "evaluating..."
  fi
  sleep 5
done