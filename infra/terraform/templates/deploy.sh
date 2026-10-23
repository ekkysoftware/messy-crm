#!/bin/bash
# Installed as /opt/messycrm/deploy.sh by Terraform user data. Switches the
# running revision: one deploy of a published tag, no infrastructure change.
#
#   sudo -n /opt/messycrm/deploy.sh <tag>
#
# The ECR login is per invocation on purpose: ECR tokens expire after 12 hours,
# so a login performed only at boot would make a deploy a day later fail with
# 403 while the old image kept running. Prints the previous tag for rollback.
set -euo pipefail

app_dir=/opt/messycrm

if [ "$#" -ne 1 ]; then
  echo "usage: deploy.sh <tag>" >&2
  exit 2
fi

if [ ! -s "$app_dir/host.env" ] || [ ! -s "$app_dir/.env" ]; then
  echo "host not bootstrapped: $app_dir/host.env or $app_dir/.env is missing (user data did not finish)" >&2
  exit 1
fi

tag="$1"

if ! [[ "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo "invalid tag: ${tag}" >&2
  exit 2
fi

# shellcheck disable=SC1091
. "$app_dir/host.env"

previous="$IMAGE_TAG"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# host.env is the source of truth: configure.sh rebuilds .env from it on every
# start, so the tag has to be recorded there to survive a restart.
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" "$app_dir/host.env"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" "$app_dir/.env"

systemctl restart messycrm.service

echo "previous=$previous"
