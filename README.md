# nemo_customiser_k8_utils

Just a bunch of scripts and UIs to make using NeMo Customiser more friendly and less manual. Mostly focused on minikube debugging. This requires NGC access, so first define:

```
export NGC_API_KEY=
export NVIDIA_API_KEY=
```

Then start the Kubernetes pods with

```
bash src/main.sh
```

To alter the microservices and models (start of with Llama 3.1 8B) that are deployed just change:

```
src/nemo-values.yaml
```
