#!/bin/bash
# Installed as /opt/messycrm/configure.sh by Terraform user data and run as the
# ExecStartPre of messycrm.service on every start.
#
# Resolves the two deployment secrets with the instance role and writes
# /opt/messycrm/.env (mode 0600) from host.env plus those secrets, then logs
# Docker in to ECR so the pull in the unit's next step works. Rotating a secret
# therefore only needs a service restart.
set -euo pipefail
umask 077

app_dir=/opt/messycrm
host_env="$app_dir/host.env"

if [ ! -r "$host_env" ]; then
  echo "missing $host_env: user data did not finish; cannot configure the stack" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$host_env"

secret_value() {
  local name="$1" key="$2" value
  value="$(aws secretsmanager get-secret-value \
            --region "$AWS_REGION" \
            --secret-id "$name" \
            --query SecretString \
            --output text 2>/dev/null \
          | jq -er --arg key "$key" '.[$key] // empty')" || {
    echo "cannot read $key from secret $name" >&2
    return 1
  }
  if [ -z "$value" ]; then
    echo "secret $name has an empty $key" >&2
    return 1
  fi
  printf '%s' "$value"
}

if ! django_key="$(secret_value "$DJANGO_SECRET_NAME" DJANGO_SECRET_KEY)"; then
  echo "missing DJANGO_SECRET_KEY in $DJANGO_SECRET_NAME: run scripts/set-secrets.sh $PROJECT_NAME $ENVIRONMENT, then restart messycrm.service" >&2
  exit 1
fi

if ! db_password="$(secret_value "$DB_SECRET_NAME" POSTGRES_PASSWORD)"; then
  echo "missing POSTGRES_PASSWORD in $DB_SECRET_NAME: run scripts/set-secrets.sh $PROJECT_NAME $ENVIRONMENT, then restart messycrm.service" >&2
  exit 1
fi

tmp_env="$(mktemp "$app_dir/.env.XXXXXX")"
trap 'rm -f "$tmp_env"' EXIT

cat "$host_env" > "$tmp_env"
{
  echo "INERTIA_VERSION=$IMAGE_TAG"
  echo "DJANGO_SECRET_KEY=$django_key"
  echo "POSTGRES_PASSWORD=$db_password"
  echo "DATABASE_URL=postgres://${POSTGRES_USER}:${db_password}@db:5432/${POSTGRES_DB}"
} >> "$tmp_env"
mv "$tmp_env" "$app_dir/.env"
chmod 0600 "$app_dir/.env"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
