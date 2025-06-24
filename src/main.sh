chmod +x install_minikube.sh create-nmp-deployment.sh
./install_minikube.sh
./create-nmp-deployment.sh --values-file nemo-values.yaml --helm-chart-url  https://helm.ngc.nvidia.com/nvidia/nemo-microservices/charts/nemo-microservices-helm-chart-25.6.0.tgz
