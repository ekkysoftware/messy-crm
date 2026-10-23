#!/usr/bin/env bash
# Run one shell command on the application host over SSM and wait for it.
#
#   scripts/ssm-run.sh <instance-id> <region> <comment> <command>
#
# Prints the command's stdout on success and both streams on failure; exits
# non-zero unless the remote command reported Success.
#
# The wait loop distinguishes "not started yet" from a real API error. Swallowing
# every error as "pending" turns a missing ssm:GetCommandInvocation grant into a
# silent ten-minute timeout.
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $(basename "$0") <instance-id> <region> <comment> <command>" >&2
  exit 2
fi

instance_id="$1"
region="$2"
comment="$3"
command="$4"

command_id="$(aws ssm send-command \
  --region "$region" \
  --instance-ids "$instance_id" \
  --document-name AWS-RunShellScript \
  --comment "$comment" \
  --parameters "commands=${command}" \
  --query 'Command.CommandId' \
  --output text)"

status=""
for _ in $(seq 1 120); do
  if output="$(aws ssm get-command-invocation \
    --region "$region" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query 'Status' \
    --output text 2>&1)"; then
    case "$output" in
      Pending | InProgress | Delayed) sleep 5 ;;
      *) status="$output"; break ;;
    esac
  else
    case "$output" in
      *InvocationDoesNotExist*) sleep 5 ;;
      *)
        echo "$output" >&2
        exit 1
        ;;
    esac
  fi
done

if [[ -z "$status" ]]; then
  echo "timed out waiting for command ${command_id} on ${instance_id}" >&2
  exit 1
fi

aws ssm get-command-invocation \
  --region "$region" \
  --command-id "$command_id" \
  --instance-id "$instance_id" \
  --query '{status: Status, stdout: StandardOutputContent, stderr: StandardErrorContent}' \
  --output json

[[ "$status" == "Success" ]]
