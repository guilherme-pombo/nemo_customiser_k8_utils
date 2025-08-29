#!/usr/bin/env bash
# install_minikube.sh — minimal, snap-free installer for: jq, yq, kubectl, helm, minikube, nvidia-ctk
set -euo pipefail

# --- arch map ---
case "$(uname -m)" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  armv7l)  ARCH="arm" ;;
  *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

# --- ensure basic deps (Debian/Ubuntu) ---
if ! command -v curl >/dev/null 2>&1 || ! command -v wget >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  sudo apt update
  sudo apt install -y curl wget jq ca-certificates gnupg lsb-release
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# --- yq (Go binary) ---
YQ_VERSION="v4.44.3"
wget -q "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_${ARCH}" -O "${tmpdir}/yq"
chmod +x "${tmpdir}/yq"
sudo install -m 0755 "${tmpdir}/yq" /usr/local/bin/yq

# --- kubectl (latest stable) ---
KVER="$(curl -sL https://dl.k8s.io/release/stable.txt)"
curl -fsSL -o "${tmpdir}/kubectl" "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl"
chmod +x "${tmpdir}/kubectl"
sudo install -m 0755 "${tmpdir}/kubectl" /usr/local/bin/kubectl

# --- helm ---
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o "${tmpdir}/get_helm.sh"
chmod +x "${tmpdir}/get_helm.sh"
HELM_INSTALL_DIR="/usr/local/bin" USE_SUDO=true "${tmpdir}/get_helm.sh"

# --- minikube ---
wget -q "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-${ARCH}" -O "${tmpdir}/minikube"
chmod +x "${tmpdir}/minikube"
sudo install -m 0755 "${tmpdir}/minikube" /usr/local/bin/minikube

# --- NVIDIA Container Toolkit (provides nvidia-ctk) ---
# repo setup
distribution=$(. /etc/os-release; echo "${ID}${VERSION_ID}")
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit.gpg
curl -s -L "https://nvidia.github.io/libnvidia-container/${distribution}/libnvidia-container.list" | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit.gpg] https://#' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null

sudo apt update
sudo apt install -y nvidia-container-toolkit

# configure runtime if docker or containerd present (best-effort)
if command -v docker >/dev/null 2>&1; then
  sudo nvidia-ctk runtime configure --runtime=docker
  if systemctl is-active --quiet docker; then
    sudo systemctl restart docker
  fi
fi

if command -v containerd >/dev/null 2>&1; then
  sudo nvidia-ctk runtime configure --runtime=containerd
  if systemctl is-active --quiet containerd; then
    sudo systemctl restart containerd
  fi
fi

# --- sanity ---
hash -r
echo "== Versions =="
yq --version
kubectl version --client --output=yaml || true
helm version || true
minikube version
nvidia-ctk --version