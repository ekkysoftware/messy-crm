#!/usr/bin/env bash
# Copy the Terraform outputs the workflows need into GitHub environment
# variables, so a pipeline never reads state.
#
#   scripts/publish-outputs.sh [workspace...]      # default: dev
#
# dev -> Staging, prod -> Production.
#
# Publishing `prod` also writes the release job's repository-scoped variables:
# that job deliberately has no GitHub environment (a second approval prompt for
# a metadata-only tag would be noise), so it cannot read environment variables.
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

original_workspace="$(terraform -chdir="$tf_dir" workspace show)"
restore_workspace() {
  terraform -chdir="$tf_dir" workspace select "$original_workspace" >/dev/null 2>&1 || true
}
trap restore_workspace EXIT

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

  if [[ "$workspace" == "prod" ]]; then
    # The promotion job pulls the image `dev` validated, so it needs that
    # workspace's repository name (same registry, different repository).
    terraform -chdir="$tf_dir" workspace select dev >/dev/null
    source_repository="$(terraform -chdir="$tf_dir" output -raw ecr_repository_name)"
    if [[ -z "$source_repository" || "$source_repository" == "None" ]]; then
      echo "output 'ecr_repository_name' is empty in workspace dev" >&2
      exit 1
    fi
    gh variable set SOURCE_ECR_REPOSITORY --env Production --repo "$GH_REPO" \
      --body "$source_repository" >/dev/null
    printf '%-9s %-18s %s\n' prod SOURCE_ECR_REPOSITORY "$source_repository"

    terraform -chdir="$tf_dir" workspace select prod >/dev/null
    release_role="$(terraform -chdir="$tf_dir" output -raw release_role_arn)"
    if [[ -z "$release_role" || "$release_role" == "None" ]]; then
      echo "output 'release_role_arn' is empty in workspace prod; apply the OIDC layer first" >&2
      exit 1
    fi

    release_map=(
      "RELEASE_ROLE_ARN:$release_role"
      "RELEASE_ECR_REGISTRY:$(terraform -chdir="$tf_dir" output -raw ecr_registry)"
      "RELEASE_ECR_REPOSITORY:$(terraform -chdir="$tf_dir" output -raw ecr_repository_name)"
      "RELEASE_AWS_REGION:$(terraform -chdir="$tf_dir" output -raw aws_region)"
    )
    for pair in "${release_map[@]}"; do
      variable="${pair%%:*}"
      value="${pair#*:}"
      gh variable set "$variable" --repo "$GH_REPO" --body "$value" >/dev/null
      printf '%-9s %-18s %s\n' release "$variable" "$value"
    done
  fi
done
