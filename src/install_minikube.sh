sudo snap install yq
pip install -U "huggingface_hub[cli]"
export PATH="$HOME/.local/bin:$PATH"

export APP_PATH=$HOME/apps
mkdir -p "$APP_PATH"
export PATH=$APP_PATH:$PATH   # make the dir visible *now*

cd "$APP_PATH"
wget -q https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 -O minikube
chmod +x minikube

curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o get_helm.sh
chmod +x get_helm.sh
USE_SUDO=false HELM_INSTALL_DIR="$APP_PATH" ./get_helm.sh   # now succeeds

curl -fsSL -o kubectl "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl

sudo snap install yq

cat <<EOF >> ~/.bashrc
export PATH=\$PATH:$APP_PATH
# tab completion in bash
source <(kubectl completion bash)
source <(helm completion bash)
# use k instead of kubectl and make sure completion works
alias k="kubectl"
complete -o default -F __start_kubectl k
EOF

source ~/.bashrc