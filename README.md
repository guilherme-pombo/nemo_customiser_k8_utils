# nemo_customiser_k8_utils

Just a bunch of scripts and UIs to make using NeMo Customiser more friendly and less manual. Mostly focused on minikube debugging.

## CUDA Driver

If on Brev machines you'll need to update your CUDA driver:

```
cd src/
bash update_drivers_to_560.sh
```

## Environment variables

This requires NGC access, so first define:

```
export NGC_API_KEY=
export NVIDIA_API_KEY=
```

If only using docker to distill you can do:

```
docker login nvcr.io -u '$oauthtoken' -p "$NGC_API_KEY"
```

and then:

```
export LOCAL_NIM_CACHE=~/.cache/nim
mkdir -p "$LOCAL_NIM_CACHE"
docker run -it --rm \
    --gpus all \
    --shm-size=16GB \
    -e NGC_API_KEY \
    -v "$LOCAL_NIM_CACHE:/opt/nim/.cache" \
    -u $(id -u) \
    -p 8000:8000 \
    nvcr.io/nim/nvidia/llama-3.3-nemotron-super-49b-v1:latest
```

## Kubernetes deployment

Then start the Kubernetes pods with

```
cd src/
bash main.sh
```

To alter the microservices and models (currently uses Llama 3.1 8B NIM) that are deployed just change:

```
src/nemo-values.yaml
```

## Adding datasets

To add a dataset to your cluster for custom evaluation

```
bash create_dataset.sh sample-basic-test ../sample_test_data default
```

## Evaluate models

To create an evaluation job for a particular model use

```
bash create_evaluation_job.sh meta/llama-3.1-8b-instruct
```

## Customise models

To create an customisation job for a particular model use

```
bash customise_model.sh meta/llama-3.1-8b-instruct@v1.0.0+A100
```

## Tear down

To clean up the cluster use:

```
cd src/
bash clean_up_cluster.sh
```

# NeMo Microservices Pipeline

End-to-end pipeline for model deployment, customization, and evaluation using NVIDIA NeMo Microservices.

## Installation

```bash
pip install nemo-microservices huggingface-hub requests
```

## Quick Start

### 1. Prepare Your Data
Create JSONL files with `prompt` and `completion` fields:
```json
{"prompt": "Question here", "completion": "Answer here"}
```

Place files in `data/` directory:
- `data/training.jsonl`
- `data/validation.jsonl`
- `data/test.jsonl`

### 2. Create Configuration
`config.json`:
```json
{
  "nds_url": "http://data-store.test",
  "nemo_url": "http://nemo.test",
  "nim_url": "http://nim.test",
  "namespace": "my-namespace",
  "dataset_name": "my-dataset",
  "base_model": "meta/llama-3.2-1b-instruct",
  "base_model_version": "v1.0.0+A100"
}
```

### 3. Run Pipeline

```bash
# Run complete pipeline
python nemo_pipeline.py --all --config config.json

# Or run individual phases
python nemo_pipeline.py --deploy                    # Deploy base model
python nemo_pipeline.py --prepare-dataset           # Upload dataset
python nemo_pipeline.py --customize                 # Fine-tune model
python nemo_pipeline.py --evaluate                  # Evaluate model
python nemo_pipeline.py --compare                   # Compare models
```

## Key Examples

### Example 1: Full Pipeline with Custom Parameters
```bash
python nemo_pipeline.py \
  --all \
  --config config.json \
  --epochs 3 \
  --batch-size 32 \
  --learning-rate 0.0002 \
  --lora-dim 32 \
  --eval-samples 100
```

### Example 2: Fine-tune Only
```bash
python nemo_pipeline.py \
  --customize \
  --namespace my-ns \
  --dataset-name my-data \
  --epochs 5 \
  --sequence-packing \
  --model-version v2
```

### Example 3: Evaluate Specific Model
```bash
python nemo_pipeline.py \
  --evaluate \
  --eval-model namespace/model-name@v1 \
  --eval-samples 200 \
  --eval-temperature 0.7
```

### Example 4: Deploy and Test
```bash
# Deploy
python nemo_pipeline.py \
  --deploy \
  --base-model meta/llama-3.2-1b-instruct \
  --gpu-count 2

# Test deployment
python nemo_pipeline.py \
  --evaluate \
  --eval-model meta/llama-3.2-1b-instruct
```

### Example 5: Compare Base vs Custom Model
```bash
python nemo_pipeline.py \
  --compare \
  --base-model meta/llama-3.2-1b-instruct \
  --eval-model my-ns/custom-model@v1 \
  --eval-samples 100
```

## Important Parameters

### Customization Options
- `--epochs`: Training epochs (default: 2)
- `--batch-size`: Batch size (default: 16)
- `--learning-rate`: Learning rate (default: 0.0001)
- `--lora-dim`: LoRA dimension (default: 16)
- `--sequence-packing`: Enable sequence packing for efficiency

### Evaluation Options
- `--eval-samples`: Number of test samples (default: 50)
- `--eval-temperature`: Generation temperature (default: 0.7)
- `--eval-max-tokens`: Max tokens to generate (default: 20)

### General Options
- `--config`: Configuration file path
- `--verbose`: Enable detailed logging
- `--output-dir`: Directory for results (default: ./output)

## Pipeline Phases

1. **Deploy**: Deploy base model as NIM service
2. **Prepare Dataset**: Upload training/validation/test data
3. **Customize**: Fine-tune model using LoRA
4. **Evaluate**: Test model performance with F1 metrics
5. **Compare**: Compare base vs custom model performance

## Output

The pipeline generates:
- Customized model deployed to NIM
- Evaluation metrics (F1 score, accuracy)
- Comparison reports between models
- Results saved to `output/` directory


