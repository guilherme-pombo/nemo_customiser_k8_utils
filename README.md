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
