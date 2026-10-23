#!/usr/bin/env bash
# Copy the Terraform outputs the workflows need into GitHub environment
# variables, so a pipeline never reads state.
#
#   scripts/publish-outputs.sh [workspace...]      # default: dev
#
# dev -> Staging, prod -> Production.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tf_dir="${TF_DIR:-$repo_root/infra/terraform}"

workspaces=("$@")
[[ ${#workspaces[@]} -gt 0 ]] || workspaces=(dev)

if [[ -z "${GH_REPO:-}" ]]; then
  GH_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

# Terraform output -> GitHub environment variable name.
map=(
  "ecr_registry:ECR_REGISTRY"
  "ecr_repository_name:ECR_REPOSITORY"
  "instance_id:INSTANCE_ID"
  "app_url:APP_URL"
  "aws_region:AWS_REGION"
  "deploy_role_arn:AWS_DEPLOY_ROLE_ARN"
)

for workspace in "${workspaces[@]}"; do
  case "$workspace" in
    dev) environment=Staging ;;
    prod) environment=Production ;;
    *)
      echo "unknown workspace: ${workspace} (expected dev or prod)" >&2
      exit 2
      ;;
  esac

  if ! terraform -chdir="$tf_dir" workspace select "$workspace" >/dev/null 2>&1; then
    echo "workspace '${workspace}' does not exist in ${tf_dir}; run terraform workspace new ${workspace}" >&2
    exit 1
  fi

  for pair in "${map[@]}"; do
    output="${pair%%:*}"
    variable="${pair##*:}"
    value="$(terraform -chdir="$tf_dir" output -raw "$output")"
    if [[ -z "$value" || "$value" == "None" ]]; then
      echo "output '${output}' is empty in workspace ${workspace}" >&2
      exit 1
    fi
    gh variable set "$variable" --env "$environment" --repo "$GH_REPO" --body "$value" >/dev/null
    printf '%-9s %-18s %s\n' "$workspace" "$variable" "$value"
  done
done
