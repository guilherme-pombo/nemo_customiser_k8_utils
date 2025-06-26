chmod +x install_minikube.sh create-nmp-deployment.sh

# Install minikube and dependencies
./install_minikube.sh

# Deploy NeMo microservices with MLflow integration
./create-nmp-deployment.sh --values-file nemo-values.yaml --helm-chart-url https://helm.ngc.nvidia.com/nvidia/nemo-microservices/charts/nemo-microservices-helm-chart-25.6.0.tgz

# Add MLFlow
echo "Installing MLflow..."
helm install -n mlflow-system --create-namespace mlflow \
  oci://registry-1.docker.io/bitnamicharts/mlflow \
  --version 1.0.6 -f mlflow.values.yaml

# Wait for MLflow to be ready
echo "Waiting for MLflow to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/mlflow-tracking -n mlflow-system

# Create MLflow secrets after MLflow is deployed
echo "Creating MLflow secrets..."

# Create MLflow credentials secret
kubectl create secret generic mlflow-credentials \
  --from-literal=username="bn_mlflow" \
  --from-literal=password="bn_mlflow" \
  --namespace=mlflow-system \
  --dry-run=client -o yaml | kubectl apply -f -

# Create customizer MLflow config secret  
kubectl create secret generic customizer-mlflow-config \
  --from-literal=MLFLOW_URL="http://mlflow-tracking.mlflow-system.svc.cluster.local:80" \
  --from-literal=MLFLOW_USERNAME="bn_mlflow" \
  --from-literal=MLFLOW_PASSWORD="bn_mlflow" \
  --namespace=default \
  --dry-run=client -o yaml | kubectl apply -f -

echo "MLflow secrets created successfully"

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
