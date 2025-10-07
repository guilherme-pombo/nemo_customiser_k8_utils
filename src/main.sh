chmod +x install_minikube.sh create-nmp-deployment.sh

# Install minikube and dependencies
./install_minikube.sh

export PATH="/home/ubuntu/apps:$PATH"
export PATH="/home/ubuntu/.local/bin:$PATH"

# Deploy NeMo microservices with MLflow integration
./create-nmp-deployment.sh --values-file nemo-values.yaml --helm-chart-url https://helm.ngc.nvidia.com/nvidia/nemo-microservices/charts/nemo-microservices-helm-chart-25.9.0.tgz

# Add MLflow domain to /etc/hosts
echo "Adding MLflow domain to /etc/hosts..."
minikube_ip=$(minikube ip)

# Check if mlflow.test entry already exists
if ! grep -q "mlflow.test" /etc/hosts; then
    echo "$minikube_ip mlflow.test" | sudo tee -a /etc/hosts
    echo "Added mlflow.test to /etc/hosts"
else
    echo "mlflow.test already exists in /etc/hosts"
fi

# Start MLflow port forwarding in background
kubectl port-forward -n mlflow-system svc/mlflow-tracking 5000:80 &

echo "Setup complete!"
echo "Access MLflow at http://mlflow.test"
echo "Access NeMo at http://nemo.test"
