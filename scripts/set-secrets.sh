#!/usr/bin/env bash
# Generate the deployment's secret material and store it in Secrets Manager.
# Prints only the secret names - never the values.
#
#   scripts/set-secrets.sh <project-name> <environment>
#
# Re-running rotates both values; the host picks them up on its next start
# (secret values are read at boot, not watched).
set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <project-name> <environment>" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage

project_name="$1"
environment="$2"
region="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"

if [[ -z "$region" ]]; then
  echo "set AWS_REGION (or AWS_DEFAULT_REGION) to the deployment region" >&2
  exit 1
fi

command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

django_secret="${project_name}/${environment}/django"
db_secret="${project_name}/${environment}/db"

django_key="$(openssl rand -base64 48)"
db_password="$(openssl rand -hex 24)"

aws secretsmanager put-secret-value \
  --region "$region" \
  --secret-id "$django_secret" \
  --secret-string "$(jq -cn --arg value "$django_key" '{DJANGO_SECRET_KEY: $value}')" \
  >/dev/null

aws secretsmanager put-secret-value \
  --region "$region" \
  --secret-id "$db_secret" \
  --secret-string "$(jq -cn --arg value "$db_password" '{POSTGRES_PASSWORD: $value}')" \
  >/dev/null

echo "$django_secret"
echo "$db_secret"
