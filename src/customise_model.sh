
#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <model_config>" >&2
  exit 1
fi

MODEL_CONFIG="$1"

export CUST_ID="$(curl -s -X POST \
  "http://nemo.test/v1/customization/jobs" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "config": "'"$MODEL_CONFIG"'",
    "dataset": {
      "name": "sample-basic-test",
      "namespace": "default"
    },
    "hyperparameters": {
      "training_type": "sft",
      "finetuning_type": "lora",
      "epochs": 3,
      "batch_size": 8,
      "learning_rate": 0.0001,
      "lora": { "adapter_dim": 16 }
    },
    "project": "test-project",
    "ownership": {
      "created_by": "me",
      "access_policies": {
        "arbitrary": "json"
      }
    },
    "output_model": "default/test-example-model@v3"
  }' | jq -r '.id')"

echo "Training job starting for: $CUST_ID"
sleep 10
while true; do
  RESPONSE=$(curl -s "http://nemo.test/v1/customization/jobs/${CUST_ID}/status")
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  echo "$RESPONSE" | jq '{steps_completed, train_loss, val_loss}'
  if [[ "$STATUS" != "running" ]]; then
    echo "Training job finished with status: $STATUS"
    break
  fi
  sleep 10
done