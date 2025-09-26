#!/usr/bin/env bash
set -euo pipefail

# Install yq via snap
sudo snap install yq

# Ensure pip is available and up to date
if ! command -v pip >/dev/null 2>&1; then
    echo "Installing pip..."
    sudo apt update
    sudo apt install -y python3-pip
fi

# Upgrade pip and install huggingface-cli
echo "Installing huggingface-cli..."
pip install --upgrade pip
pip install -U "huggingface_hub[cli]"

# Make sure ~/.local/bin is in PATH for this session
export PATH="$HOME/.local/bin:$PATH"

# Verify huggingface-cli installation
if command -v huggingface-cli >/dev/null 2>&1; then
    echo "✓ huggingface-cli installed successfully: $(which huggingface-cli)"
else
    echo "Error: huggingface-cli installation failed"
    echo "Checking ~/.local/bin contents:"
    ls -la ~/.local/bin/ || echo "~/.local/bin directory not found"
    exit 1
fi

# Set up apps directory
export APP_PATH=$HOME/apps
mkdir -p "$APP_PATH"
export PATH=$APP_PATH:$PATH

cd "$APP_PATH"

# Install minikube
echo "Installing minikube..."
wget -q https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 -O minikube
chmod +x minikube

# Install helm
echo "Installing helm..."
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o get_helm.sh
chmod +x get_helm.sh
USE_SUDO=false HELM_INSTALL_DIR="$APP_PATH" ./get_helm.sh

# Install kubectl
echo "Installing kubectl..."
curl -fsSL -o kubectl "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl

# Verify all tools are installed
echo "Verifying installations..."
"$APP_PATH/minikube" version --short || echo "Warning: minikube verification failed"
"$APP_PATH/kubectl" version --client --short || echo "Warning: kubectl verification failed"
"$APP_PATH/helm" version --short || echo "Warning: helm verification failed"
huggingface-cli --version || echo "Warning: huggingface-cli verification failed"

# Update bashrc with proper PATH settings
cat <<EOF >> ~/.bashrc

# Added by NeMo setup script
export PATH=\$PATH:$APP_PATH
export PATH=\$PATH:\$HOME/.local/bin

# Tab completion in bash
if command -v kubectl >/dev/null 2>&1; then
    source <(kubectl completion bash)
fi
if command -v helm >/dev/null 2>&1; then
    source <(helm completion bash)
fi

# Use k instead of kubectl and make sure completion works
alias k="kubectl"
if command -v kubectl >/dev/null 2>&1; then
    complete -o default -F __start_kubectl k
fi
EOF

echo "Installation complete!"
echo "Tools installed to: $APP_PATH"
echo "Python packages installed to: ~/.local/bin"
echo "PATH has been updated in ~/.bashrc"

# Source bashrc for current session
source ~/.bashrc
