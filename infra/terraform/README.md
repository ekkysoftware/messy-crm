# messycrm on AWS (Terraform root module)

Provisions one self-hosted environment for the CRM application from code:

| Resource | What it is |
| --- | --- |
| `aws_ecr_repository` + lifecycle policy | Private registry for the application image, immutable tags, last 10 tagged images kept |
| `aws_instance` | Amazon Linux 2023 host running the Docker Compose stack |
| `aws_ebs_volume` + attachment | Encrypted gp3 volume that holds PostgreSQL data independently of the instance |
| `aws_eip` + association | Stable public address across stop/start and instance replacement |
| `aws_secretsmanager_secret` ×2 | Secret *containers* for the Django key and the database password |
| `aws_cloudwatch_log_group` | Central log destination with a bounded retention |
| Security group, IAM role/profile, inline policies | HTTP ingress from `app_ingress_cidr`, ECR pull, secret read, log write, SSM access |

The application itself is defined once, in the repository-root `compose.prod.yml`, and runs
unchanged in every workspace. Terraform renders host configuration; the host is disposable.

## Prerequisites

- Terraform ≥ 1.6, AWS CLI v2, Docker with `buildx`, `jq`, `openssl`
- An AWS account with a **default VPC** in the target region (used instead of building a VPC)
- Credentials for the operator apply below. `AdministratorAccess` is sufficient; the minimum
  service coverage is:
  - EC2: `DescribeVpcs`, `DescribeSubnets`, `RunInstances`, `TerminateInstances`,
    `CreateVolume`, `DeleteVolume`, `AttachVolume`, `DetachVolume`, `AllocateAddress`,
    `ReleaseAddress`, `AssociateAddress`, `DisassociateAddress`, `CreateSecurityGroup`,
    `DeleteSecurityGroup`, `AuthorizeSecurityGroupIngress`, `RevokeSecurityGroupIngress`,
    `AuthorizeSecurityGroupEgress`, `RevokeSecurityGroupEgress`, `CreateTags`, `Describe*`
  - ECR: `CreateRepository`, `DeleteRepository`, `PutLifecyclePolicy`, `Describe*`,
    `GetAuthorizationToken`, `InitiateLayerUpload`/`CompleteLayerUpload`/`PutImage`
    (push side)
  - IAM: `CreateRole`, `DeleteRole`, `PutRolePolicy`, `DeleteRolePolicy`,
    `AttachRolePolicy`, `DetachRolePolicy`, `CreateInstanceProfile`, `DeleteInstanceProfile`,
    `AddRoleToInstanceProfile`, `RemoveRoleFromInstanceProfile`, `GetRole`
  - Secrets Manager: `CreateSecret`, `DeleteSecret`, `PutSecretValue`, `GetSecretValue`
  - CloudWatch Logs: `CreateLogGroup`, `DeleteLogGroup`, `PutRetentionPolicy`
  - SSM: `GetParameter` (AMI lookup), `SendCommand`, `GetCommandInvocation`,
    `StartSession` (deploy and diagnostics)

## Workspaces: one environment per workspace

The same configuration is applied once per Terraform workspace, and `var.environment` is
passed explicitly so resource names, the `Environment` tag and the other per-environment
names match the workspace:

```bash
terraform init

terraform workspace new dev
# dev creates the account-wide GitHub OIDC provider (one workspace only).
terraform apply -var project_name=messycrm -var environment=dev \
  -var create_github_oidc_provider=true

terraform workspace new prod
terraform apply -var project_name=messycrm -var environment=prod

terraform workspace list        # default, dev, prod
terraform workspace select dev
terraform output environment    # dev
```

Each workspace keeps its own state under `terraform.tfstate.d/<workspace>/`, so two
workspaces never share a host, registry, secret entry, log group or Elastic IP. Select the
workspace before every `plan`, `apply`, `destroy` **and before running the scripts below** —
they read their target from the selected workspace. `terraform output environment` echoes the
active workspace, so a run against the wrong environment is visible immediately.

State is local and git-ignored (`.terraform/`, `terraform.tfstate`, `terraform.tfstate.*`,
`terraform.tfstate.d/`, `*.tfplan`, `terraform.tfvars`), with no remote backend and no state
locking — one operator at a time. Losing the state file orphans billable resources; recover a
volume with `terraform import aws_ebs_volume.data <volume-id>` rather than creating a new one.

## Bootstrap order (per workspace)

```bash
cd infra/terraform
terraform workspace select dev

# 1. Infrastructure: registry, secrets containers, log group, volume, host, EIP.
#    The unit starts and its configure.sh step fails loudly until step 2 has run.
#    `create_github_oidc_provider=true` belongs to the FIRST workspace applied
#    (normally dev): the provider is an account-level singleton. Leaving the flag
#    out of a later dev apply plans a destroy of that provider and breaks the
#    deploy role of every workspace.
terraform apply -var project_name=messycrm -var environment=dev \
  -var create_github_oidc_provider=true

# 2. Secret values (out of band on purpose: never in Terraform state or plan).
AWS_REGION=ap-southeast-3 ../../scripts/set-secrets.sh messycrm dev

# 3. First image, built for linux/amd64 and pushed to this workspace's repository.
../../scripts/push-image.sh "$(git rev-parse --short HEAD)"

# 4. Deploy it: fresh ECR login, tag switch, service restart (which also picks up
#    the secret values written in step 2).
../../scripts/deploy.sh "$(git rev-parse --short HEAD)"
```

`terraform destroy`, or the host's own `deploy.sh`, is the only way to move backwards; the
image tag lives in `/opt/messycrm/host.env` on the host, not in Terraform.

## Variables

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project_name` | `string` | — (required) | Project name used as the prefix for resource names and for the Project tag. |
| `aws_region` | `string` | `ap-southeast-3` | AWS region every resource is created in. |
| `environment` | `string` | `prod` | Environment name, expected to match the active Terraform workspace (e.g. dev, prod). |
| `instance_type` | `string` | `t3.small` | EC2 instance type for the application host. |
| `app_ingress_cidr` | `string` | `0.0.0.0/0` | CIDR block allowed to reach the application port (80). |
| `data_volume_size_gb` | `number` | `20` | Size in GiB of the encrypted gp3 EBS volume that holds PostgreSQL data. |
| `log_retention_days` | `number` | `14` | Retention period in days for the application CloudWatch log group. |
| `compose_version` | `string` | `2.32.4` | Pinned Docker Compose v2 plugin version installed on the host. |
| `image_tag` | `string` | `bootstrap` | Image tag the host runs until a deploy switches it; `bootstrap` is the pre-first-push placeholder. |

`terraform.tfvars.example` shows the same values in HCL form; copy it to `terraform.tfvars`
(git-ignored) if you prefer a file over `-var` flags.

## Outputs

| Output | Use |
| --- | --- |
| `app_url` | `http://<eip>` - the address to open |
| `public_ip` | Elastic IP, used by the host for `ALLOWED_HOSTS`/CSRF |
| `ecr_registry`, `ecr_repository_name`, `ecr_repository_url` | Push target for `scripts/push-image.sh` |
| `instance_id` | SSM target for `scripts/deploy.sh` and `aws ssm start-session` |
| `instance_role_arn` | Identity the host uses for ECR pull, secrets and logs |
| `log_group_name` | `aws logs tail "$(terraform output -raw log_group_name)" --follow` |
| `aws_region`, `environment` | Confirm which environment a command targets |

## What runs on the host

Terraform renders everything into `/opt/messycrm` through `templates/user_data.sh.tftpl`:

| Path | Written by | Purpose |
| --- | --- | --- |
| `/opt/messycrm/host.env` | user data | Non-secret configuration (registry, log group, region, EIP, image tag, secret names) |
| `/opt/messycrm/compose.yml` | user data | The repository's `compose.prod.yml`, verbatim |
| `/opt/messycrm/configure.sh` | user data (`templates/configure.sh`) | Reads both secrets with the instance role, writes `.env` (mode `0600`), logs Docker in to ECR. Run as the unit's `ExecStartPre`, so it also recovers a host that booted before its secrets existed, and picks up rotated secrets on restart |
| `/opt/messycrm/deploy.sh` | user data (`templates/deploy.sh`) | The single release helper: previous tag, fresh ECR login, tag switch, restart |
| `/opt/messycrm/.env` | `configure.sh` | Secret + non-secret environment of the Compose stack, mode `0600` |
| `/etc/systemd/system/messycrm.service` | user data (`templates/messycrm.service`) | `Type=oneshot` + `RemainAfterExit=yes`: `configure.sh`, best-effort `pull`, then `up -d`; `Restart=on-failure` retries until an image exists, enabled at boot. (Container crashes are covered by the Compose `restart: unless-stopped` policy, not by systemd) |
| `/srv/messycrm/postgres` | user data | Mount point of the EBS volume (`LABEL=messycrm-data`, `nofail`) |

The volume is formatted only when no `messycrm-data` label exists, so a reboot or instance
replacement never re-formats it; the mount is by label because Nitro instances rename
`/dev/sdf` to `/dev/nvme1n1`.

Diagnostics without SSH:

```bash
aws ssm start-session --target "$(terraform output -raw instance_id)"
sudo journalctl -u messycrm -n 100 --no-pager
sudo docker compose -f /opt/messycrm/compose.yml --env-file /opt/messycrm/.env ps
```

## How `compose.prod.yml` differs from `compose.yml`

The two files describe the same two services, so only these differences are intentional:

| Difference | Why |
| --- | --- |
| `web.image` = `${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}` instead of `build: .` | The host never builds; it pulls an immutable tag from the private registry |
| `web.environment.INERTIA_VERSION` = `${IMAGE_TAG}` instead of `${INERTIA_VERSION:-local}` | The Inertia asset version must equal the deployed revision |
| `web.environment.DATABASE_URL` read from `.env` instead of being assembled inline | `configure.sh` is the single place that knows the generated password, and it writes the URL next to it |
| `web.environment.RUN_MIGRATIONS: "true"` added | Explicit on the host instead of relying on the entrypoint's default |
| `db.ports` removed | The database is never published; `web` reaches it over the Compose network |
| `db.volumes` bind-mounts `/srv/messycrm/postgres`, and `db.environment.PGDATA` points at `pgdata` inside it | Data lives on the retained EBS volume, not a Docker named volume on the root disk. The mount root holds `lost+found` (created by `mkfs.ext4`), which `initdb` refuses to initialize in, so the cluster lives in a subdirectory of the mount |
| `logging` (`awslogs`) added to both services | Container output ships to CloudWatch with bounded retention; one stable stream per service (`db`, `web`). Docker's `awslogs` driver has no stream *prefix* option - that field is ECS-only - so the stream name is set explicitly |

The `web` environment *key sets* differ only by `RUN_MIGRATIONS`, and no key of `compose.yml`
is missing from `compose.prod.yml`; `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`,
`DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS` and `DATABASE_URL` are identical in
name and meaning.

## Publishing, deploying, rolling back

```bash
# build for linux/amd64, push <registry>/<repo>:<tag>; refuses a tag that already exists
scripts/push-image.sh <tag>

# SSM wrapper: sends `sudo -n /opt/messycrm/deploy.sh <tag>` and prints id + status
scripts/deploy.sh <tag> [--instance-id <id>]
```

Both read the target from the selected workspace (`terraform -chdir=infra/terraform output`).
`deploy.sh` prints the previous tag; rollback is the same call with that tag. ECR is
`IMMUTABLE`, so a published tag can never be silently overwritten. Re-deploying never touches
Terraform.

## Verifying that secrets never enter state or plan output

The only way a value reaches Secrets Manager is `scripts/set-secrets.sh`; Terraform manages
containers, not versions. To check the property on a provisioned environment:

```bash
cd infra/terraform
terraform plan -var project_name=messycrm -var environment=dev -out=/tmp/tfplan >/dev/null
secrets=$(aws secretsmanager get-secret-value --secret-id messycrm/dev/django \
            --query SecretString --output text | jq -r '.[]')
secrets+=$'\n'$(aws secretsmanager get-secret-value --secret-id messycrm/dev/db \
            --query SecretString --output text | jq -r '.[]')
printf '%s\n' "$secrets" | grep -F -f - <(strings terraform.tfstate /tmp/tfplan)
# Expected: no output and exit status 1 (no plaintext secret in state or plan).
#
# Recorded on the `dev` environment (applied 2026-10-23):
#   strings terraform.tfstate.d/dev/terraform.tfstate /tmp/tfplan | grep -c -F -f <secrets>
#   -> 0   (grep exit status 1: no plaintext secret in state or in the plan).
```

## Post-apply verification (mirrors `openspec/changes/terraform-aws/tasks.md`)

Run these once the environment exists. `ws` is the selected workspace; every command assumes
`cd infra/terraform` and the matching `AWS_REGION`.

| Task | Check |
| --- | --- |
| 3.1 | `aws ecr describe-repositories --repository-names "$(terraform output -raw ecr_repository_name)" --query 'repositories[0].imageTagMutability'` → `IMMUTABLE`; pushing an existing tag again fails with `tag invalid: The image tag … already exists` |
| 3.2 | `aws iam simulate-principal-policy --policy-source-arn "$(terraform output -raw instance_role_arn)" --action-names ecr:BatchGetImage ecr:DeleteRepository --resource-arns "$(terraform output -raw ecr_repository_url)"` → pull `allowed`, delete `implicitDeny` |
| 3.3 | `terraform output -json` in `dev` and `prod` shows every output with workspace-specific values; a following `terraform plan` reports no changes |
| 3.4 | `ecr_repository_name` differs per workspace and `app_url` matches that workspace's `public_ip` |
| 4.2 | `aws secretsmanager get-secret-value --secret-id "$PROJECT/$ENV/django" --query SecretString --output text \| jq -e .` (same for `db`) |
| 4.3 | The secret-free state check above prints nothing |
| 5.2 | `curl -s https://checkip.amazonaws.com` from the host (`aws ssm start-session`) equals `terraform output public_ip`; `stop`/`start` leaves the EIP unchanged |
| 5.3 | `lsblk -fs` on the host lists `messycrm-data` mounted at `/srv/messycrm/postgres` |
| 6.1 | `terraform plan` shows the SSM AMI id; after `apply`, `aws ec2 describe-instances --instance-ids "$(terraform output -raw instance_id)" --query 'Reservations[0].Instances[0].State.Name'` → `running` |
| 6.2 | `stat -c '%a' /opt/messycrm/.env` → `600`; `systemctl is-enabled messycrm` → `enabled`; `sudo -n /opt/messycrm/deploy.sh <tag>` works; after reboot the stack is up and the mount attached |
| 6.3 | On a host applied before `set-secrets.sh`: `journalctl -u messycrm` shows `missing DJANGO_SECRET_KEY …`/`missing POSTGRES_PASSWORD …` and `docker ps` shows no web container |
| 6.4 | After `sudo docker logout "$(terraform output -raw ecr_registry)"`, `sudo -n /opt/messycrm/deploy.sh <existing-tag>` pulls successfully and prints `previous=<old-tag>` |
| 7.1 | `aws logs describe-log-groups --log-group-name-prefix "$(terraform output -raw log_group_name)" --query 'logGroups[0].retentionInDays'` → `14` |
| 7.2 | `aws logs tail "$(terraform output -raw log_group_name)" --since 10m` shows gunicorn startup and `migrate` output, one stream per service |
| 8.1 | `aws ecr list-images --repository-name "$(terraform output -raw ecr_repository_name)"` lists the tag; the digest equals `docker inspect --format '{{index .RepoDigests 0}}' <image>` |
| 8.2 | `scripts/deploy.sh <older-tag>` serves that revision again; a new tag changes the bundle hash under `/static/crm/assets/`; a failing remote command exits non-zero |
| 8.3 | Every command in this README runs as written in both workspaces |
| 9.1 | `curl -fsS "$(terraform output -raw app_url)/"` returns the dashboard with a hashed asset, and a status-change command redirects and renders a flash message |
| 9.2 | Create a contact, then `terraform apply -replace=aws_instance.app …`; the contact is still listed on the same Elastic IP |
| 9.3 | A second `terraform apply` plans no changes; `terraform destroy` removes host, EIP, volume, repository, secret containers and log group (`aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=messycrm`) |

## Teardown

```bash
# Optional but recommended: snapshot the data volume first.
aws ec2 create-snapshot --volume-id "$(aws ec2 describe-volumes \
  --filters Name=tag:Name,Values=messycrm-dev-data --query 'Volumes[0].VolumeId' --output text)" \
  --description "messycrm dev pre-destroy"

terraform workspace select dev
terraform destroy -var project_name=messycrm -var environment=dev
```

`terraform destroy` **deletes the PostgreSQL volume and everything on it**; the snapshot above
is the only way back. The repository is deleted with its images, and the secret containers are
deleted immediately (their recovery window is `0`). Destroy one workspace at a time; the other
workspace's host, address and data are untouched.

## Caveats

- **No TLS.** Session and CSRF cookies travel over plain HTTP; narrow `app_ingress_cidr` to the
  operator's address to reduce exposure.
- **Single host**, no autoscaling, no rolling deploys: a host-level change replaces the
  instance (~1 minute outage, `migrate` re-runs, EIP re-associates, data stays).
- **Secrets are read at boot**: rotating a secret needs `sudo systemctl restart messycrm` (or
  any `scripts/deploy.sh` call); there is no watcher.
- **Local state, no locking**: one operator, one working copy. Keep
  `infra/terraform/terraform.tfstate.d/` safe.
- **Two workspaces, one code base**: `var.environment` must match the selected workspace; the
  `environment` output exists to make a mismatch obvious.
- **The GitHub OIDC provider is an account singleton** owned by the workspace that created it
  (`create_github_oidc_provider = true`, normally `dev`). Applying that workspace without the
  flag plans `aws_iam_openid_connect_provider.github[0] will be destroyed` and forfeits the
  deploy role's trust for both environments. Everything else uses a data source, so `prod`
  never needs the flag.
- **The first apply produces a host without an image**: the unit restarts until
  `push-image.sh` + `deploy.sh` have run. That window is one documented step, not a fault.

## Out of scope

TLS/ACM, Route 53 and custom domains, ALB/NLB, CDN/WAF, RDS and managed backups, multi-AZ,
autoscaling, remote state, and the GitHub Actions pipeline. HTTP on the Elastic IP is the
transport for this environment.
