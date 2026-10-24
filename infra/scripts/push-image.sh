#!/usr/bin/env bash
# Build the application image for linux/amd64 and push it to the ECR repository
# of the currently selected Terraform workspace.
#
#   infra/scripts/push-image.sh <tag>
#
# Tags are immutable in ECR: pushing a tag that already exists fails instead of
# silently replacing the revision a deployment might still point at.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tf_dir="${TF_DIR:-$repo_root/infra/terraform}"

usage() {
  echo "usage: $(basename "$0") <tag>" >&2
  exit 2
}

[[ $# -eq 1 ]] || usage
tag="$1"

registry="$(terraform -chdir="$tf_dir" output -raw ecr_registry)"
repository="$(terraform -chdir="$tf_dir" output -raw ecr_repository_name)"
region="$(terraform -chdir="$tf_dir" output -raw aws_region)"
environment="$(terraform -chdir="$tf_dir" output -raw environment)"
image="${registry}/${repository}:${tag}"

echo "environment=${environment} image=${image}"

if aws ecr describe-images \
  --region "$region" \
  --repository-name "$repository" \
  --image-ids "imageTag=${tag}" >/dev/null 2>&1; then
  echo "tag ${tag} already exists in ${repository} (IMMUTABLE); choose a new tag" >&2
  exit 1
fi

aws ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"

docker buildx build \
  --platform linux/amd64 \
  --load \
  -f "$repo_root/Dockerfile" \
  -t "$image" \
  "$repo_root"

docker push "$image"
