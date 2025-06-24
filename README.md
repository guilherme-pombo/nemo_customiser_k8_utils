# nemo_customiser_k8_utils

Just a bunch of scripts and UIs to make using NeMo Customiser more friendly and less manual. Mostly focused on minikube debugging. This requires NGC access, so first define:

```
export NGC_API_KEY=
export NVIDIA_API_KEY=
```

Then start the Kubernetes pods with

```
cd src/
bash main.sh
```

To alter the microservices and models (currently uses Llama 3.1 8B NIM) that are deployed just change:

```
src/nemo-values.yaml
```

Then to add a dataset to your cluster for custom evaluation

```
bash create_dataset.sh sample-basic-test ../sample_test_data default
```

To clean up the cluster use:

```
cd src/
bash clean_up_cluster.sh
```
