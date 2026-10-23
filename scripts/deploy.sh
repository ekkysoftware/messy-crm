#!/usr/bin/env bash
# Deploy a published tag by invoking the host's own deploy helper over SSM.
#
#   scripts/deploy.sh <tag> [--instance-id <id>]
#
# The host helper (/opt/messycrm/deploy.sh) is the same one CI invokes, so the
# manual fallback and the pipeline cannot drift. Nothing is provisioned here.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tf_dir="${TF_DIR:-$repo_root/infra/terraform}"

usage() {
  echo "usage: $(basename "$0") <tag> [--instance-id <id>]" >&2
  exit 2
}

tag=""
instance_id=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance-id)
      instance_id="${2:-}"
      [[ -n "$instance_id" ]] || usage
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*)
      echo "unknown option: $1" >&2
      usage
      ;;
    *)
      [[ -z "$tag" ]] || { echo "only one tag may be given" >&2; usage; }
      tag="$1"
      shift
      ;;
  esac
done

[[ -n "$tag" ]] || usage

if ! [[ "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "invalid tag: ${tag}" >&2
  exit 2
fi

if [[ -z "$instance_id" ]]; then
  instance_id="$(terraform -chdir="$tf_dir" output -raw instance_id)"
fi

region="$(terraform -chdir="$tf_dir" output -raw aws_region)"

# The wait-and-report logic lives in ssm-run.sh so the pipeline and this manual
# wrapper cannot drift, and so a real API error fails fast instead of looking
# like a slow command.
exec "$repo_root/scripts/ssm-run.sh" "$instance_id" "$region" "messycrm deploy ${tag}" \
  "sudo -n /opt/messycrm/deploy.sh ${tag}"
