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

command_id="$(aws ssm send-command \
  --region "$region" \
  --instance-ids "$instance_id" \
  --document-name AWS-RunShellScript \
  --comment "messycrm deploy ${tag}" \
  --parameters "commands=sudo -n /opt/messycrm/deploy.sh ${tag}" \
  --query 'Command.CommandId' \
  --output text)"

echo "command_id=${command_id} instance=${instance_id} tag=${tag}"

status="Pending"
for _ in $(seq 1 120); do
  status="$(aws ssm get-command-invocation \
    --region "$region" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query 'Status' \
    --output text 2>/dev/null || echo Pending)"
  case "$status" in
    Pending|InProgress|Delayed) sleep 5 ;;
    *) break ;;
  esac
done

aws ssm get-command-invocation \
  --region "$region" \
  --command-id "$command_id" \
  --instance-id "$instance_id" \
  --query '{status: Status, stdout: StandardOutputContent, stderr: StandardErrorContent}' \
  --output json

echo "status=${status}"

if [[ "$status" != "Success" ]]; then
  exit 1
fi
