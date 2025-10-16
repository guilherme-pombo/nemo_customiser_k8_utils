#!/usr/bin/env bash
set -euo pipefail

# Make scripts executable
chmod +x install_minikube.sh create-nmp-deployment.sh

# Install minikube and dependencies
echo "Installing minikube and dependencies..."
./install_minikube.sh

# Set up PATH to include the newly installed tools
export APP_PATH=$HOME/apps
export PATH="$APP_PATH:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# Also source bashrc to pick up any additional PATH updates
if [[ -f ~/.bashrc ]]; then
    set +e
    source ~/.bashrc
    set -e
fi

# Verify tools are available
echo "Verifying installed tools..."
if ! command -v minikube >/dev/null 2>&1; then
    echo "Error: minikube not found in PATH after installation"
    echo "Current PATH: $PATH"
    echo "Contents of $APP_PATH:"
    ls -la "$APP_PATH" || echo "Directory $APP_PATH not found"
    exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
    echo "Error: kubectl not found in PATH after installation"
    exit 1
fi

if ! command -v huggingface-cli >/dev/null 2>&1; then
    echo "Error: huggingface-cli not found in PATH after installation"
    echo "Checking ~/.local/bin:"
    ls -la ~/.local/bin/ || echo "~/.local/bin not found"
    exit 1
fi

echo "All tools verified successfully!"

# Deploy NeMo microservices with MLflow integration
echo "Deploying NeMo microservices..."
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
echo "Starting MLflow port forwarding..."
kubectl port-forward -n mlflow-system svc/mlflow-tracking 5000:80 &
MLflow_PID=$!

echo "Setup complete!"
echo "Access MLflow at http://mlflow.test"
echo "Access NeMo at http://nemo.test"
echo "MLflow port forwarding PID: $MLflow_PID"
echo ""
echo "To stop MLflow port forwarding later, run: kill $MLflow_PID"
