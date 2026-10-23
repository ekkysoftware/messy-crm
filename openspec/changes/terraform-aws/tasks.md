# Tasks

## 1. Terraform module scaffold

- [x] 1.1 Create `infra/terraform/` with `versions.tf` and `providers.tf` pinning `required_version >= 1.6.0` and `hashicorp/aws ~> 5.60` with default tags (`Project`, `Environment`, `ManagedBy = terraform`); verify `terraform init && terraform fmt -check -recursive && terraform validate` all succeed
- [x] 1.2 Add `variables.tf` with required `project_name` (no default), plus `aws_region` (default `ap-southeast-3`), `environment` (default `prod`), `instance_type` (default `t3.small`), `app_ingress_cidr` (default `0.0.0.0/0`), `data_volume_size_gb` (default `20`), `log_retention_days` (default `14`), `compose_version` (default `2.32.4`), `image_tag` (default `bootstrap`); verify `terraform plan` without `project_name` fails with the variable's error message and no resource is planned, and that `terraform output aws_region` reports `ap-southeast-3` without any `-var` override
- [x] 1.3 Add `terraform.tfvars.example` and ignore `infra/terraform/{.terraform,*.tfstate,*.tfstate.*,terraform.tfstate.d,*.tfplan,terraform.tfvars}` in `.gitignore`; verify `git status --porcelain` stays clean after `terraform init`, a `plan` run, and `terraform workspace new dev` (the workspace state directory must not appear as untracked)
- [x] 1.4 Document and verify the two-workspace workflow (`terraform workspace new dev` / `prod`, then `apply -var environment=<ws>`), and make `outputs.tf` report the active workspace in an `environment` output; verify `terraform workspace list` shows `default`, `dev`, `prod` and that `terraform output environment` matches the selected workspace in each

## 2. Production Compose file

- [x] 2.1 Add root `compose.prod.yml` with `name: messy-crm`, `db` (no published port, bind mount `/srv/messycrm/postgres:/var/lib/postgresql/data`, `POSTGRES_PASSWORD` from the boot env) and `web` (`${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}`, `ports: ["80:8000"]`, `DJANGO_*`, `DATABASE_URL`, `INERTIA_VERSION=${IMAGE_TAG}`, `RUN_MIGRATIONS=true`, `restart: unless-stopped`, `awslogs` logging with `${LOG_GROUP}`/`${AWS_REGION}/awslogs-stream-prefix`); verify `docker compose -f compose.prod.yml config` renders the expected image reference, port mapping and logging block when the referenced env vars are supplied
- [x] 2.2 Confirm the two Compose files do not drift on application settings: diff the `environment` keys of `web` in `compose.yml` and `compose.prod.yml` and document any intentional difference (only `IMAGE_TAG`/`INERTIA_VERSION` source and logging are expected); verify the diff contains no unexpected key

## 3. Registry and instance identity

- [x] 3.1 Add `ecr.tf` with `aws_ecr_repository` (`image_tag_mutability = "IMMUTABLE"`, `scan_on_push = true`) and a lifecycle policy keeping the last 10 tagged images and expiring untagged ones after 1 day; verify `terraform plan` shows the repository with IMMUTABLE mutability and that `aws ecr put-image --image-tag <existing-tag>` against it is rejected after the first push
- [x] 3.2 Add `iam.tf` with the instance role and instance profile granting only `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` on the repository ARN, plus the `AmazonSSMManagedInstanceCore` managed policy; verify `aws iam simulate-principal-policy` (or a live pull from the host) shows a pull allowed and `ecr:DeleteRepository` denied
- [ ] 3.3 Export from `outputs.tf` — `ecr_registry`, `ecr_repository_url`, `ecr_repository_name`, `instance_id`, `instance_role_arn`, `public_ip`, `app_url` (`http://<eip>`), `log_group_name`, `aws_region`, `environment` — for both workspaces; verify `terraform workspace select dev && terraform output -json` and the same for `prod` return all keys with environment-specific values, and that `terraform plan` afterwards reports no changes
- [ ] 3.4 Verify the CI-facing names are stable and collision-free: `terraform output ecr_repository_name` differs between the `dev` and `prod` workspaces, and each `app_url` resolves to that workspace's own Elastic IP

## 4. Secrets

- [x] 4.1 Add `secrets.tf` creating `aws_secretsmanager_secret` for `<project>/<env>/django` and `<project>/<env>/db` **without** managed `aws_secretsmanager_secret_version` resources, plus a `GetSecretValue` policy scoped to those two ARNs attached to the instance role; verify `grep -c secret_version infra/terraform/*.tf` returns 0 and `terraform plan` shows only the two containers
- [x] 4.2 Add `scripts/set-secrets.sh` that generates a Django key (`openssl rand -base64 48`) and a Postgres password (`openssl rand -hex 24`), writes `{"DJANGO_SECRET_KEY": …}` and `{"POSTGRES_PASSWORD": …}` via `aws secretsmanager put-secret-value`, and prints only the secret names; verify the round trip with `aws secretsmanager get-secret-value --query SecretString --output text | jq -e .` for both secrets
- [x] 4.3 Verify the state is secret-free: run `terraform plan -out=/tmp/tfplan`, then `strings terraform.tfstate /tmp/tfplan | grep -F -f <(aws secretsmanager get-secret-value … → jq -r '.[]')` and confirm no match; record the command output in the module README

## 5. Network, address, and storage

- [x] 5.1 Add `network.tf` resolving `data.aws_vpc.default` and `data.aws_subnets` for it, plus one security group allowing inbound `80` from `var.app_ingress_cidr` and all egress; verify `terraform plan` creates exactly one security group, no VPC, and no inbound rule for `22`
- [x] 5.2 Add `aws_eip` plus its `aws_eip_association` against the instance; verify `terraform output public_ip` equals the address later returned by `curl -s https://checkip.amazonaws.com`-style lookup through the host, and that `terraform plan` after `stop`/`start` shows no EIP change
- [x] 5.3 Add `storage.tf` with `aws_ebs_volume` (`gp3`, `encrypted = true`, `size = var.data_volume_size_gb`, availability zone = the instance's) and `aws_volume_attachment` on `/dev/sdf` without `delete_on_termination` on the instance; verify `terraform plan` shows the volume, and after boot `lsblk -fs` on the host reports `messycrm-data` mounted at `/srv/messycrm/postgres`

## 6. Host and boot configuration

- [x] 6.1 Add an AMI lookup via the public SSM parameter `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64` and `compute.tf` creating the instance (gp3 30 GiB encrypted root, instance profile, security group, `user_data`, `user_data_replace_on_change = true`); verify `terraform plan` shows the expected AMI id and that `terraform apply` reaches `running` state
- [x] 6.2 Add `templates/user_data.sh.tftpl` that installs `docker`, `jq` and the pinned Compose v2 plugin, formats only when `blkid -L messycrm-data` is empty, mounts `/srv/messycrm/postgres` by `LABEL=messycrm-data` with `nofail`, resolves both secrets through the instance role, writes `/opt/messycrm/.env` with mode `0600` containing `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS=<eip>`, `DJANGO_CSRF_TRUSTED_ORIGINS=http://<eip>`, `INERTIA_VERSION`, `IMAGE_TAG`, `ECR_REGISTRY`, `ECR_REPOSITORY`, `LOG_GROUP`, `AWS_REGION`, writes `/opt/messycrm/compose.yml` from the rendered `compose.prod.yml`, performs one `aws ecr get-login-password | docker login` so the first pull works, installs `/opt/messycrm/deploy.sh` (executable, the helper from design decision 6), and installs `messycrm.service` (`docker compose pull` best-effort, `up -d`, `Restart=always`, enabled at boot); verify over SSM (`aws ssm start-session` or `send-command`) that `stat -c '%a' /opt/messycrm/.env` is `600`, `systemctl is-enabled messycrm` is `enabled`, `/opt/messycrm/deploy.sh` runs, and rebooting the host leaves the container up and the mount attached
- [x] 6.3 Verify the boot script fails loudly rather than silently with an empty password: on a fresh instance before secrets exist, confirm the unit's journal shows an explicit missing-secret error and the container does not start with a blank `POSTGRES_PASSWORD`
- [x] 6.4 Verify the deploy helper covers token expiry: on a host booted more than 12 hours earlier (or after `docker logout`), run `sudo -n /opt/messycrm/deploy.sh <existing-tag>` and confirm the pull succeeds instead of failing with `403`, and that the previous tag is printed to stdout

## 7. Observability

- [x] 7.1 Add `observability.tf` with `aws_cloudwatch_log_group` for `<project>-<env>-app` using `var.log_retention_days`, and extend the instance policy with `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogStreams` scoped to that group's ARN; verify `aws logs describe-log-groups --log-group-name-prefix <project>-<env>-app --query 'logGroups[0].retentionInDays'` returns the configured value
- [x] 7.2 Verify container output arrives in CloudWatch after a redeploy: `aws logs tail /aws/… --since 10m` shows the gunicorn startup lines and the `migrate` output, with one stream per service under the configured prefix

## 8. Publish, deploy, and runbook

- [x] 8.1 Add `scripts/push-image.sh <tag>` that builds `-f Dockerfile .` for `linux/amd64`, logs in with `aws ecr get-login-password`, tags `<registry>/<repo>:<tag>` and pushes, failing when the tag exists in an IMMUTABLE repository; verify the image is listed by `aws ecr list-images` and the displayed digest matches the local `docker inspect --format '{{index .RepoDigests 0}}'`
- [ ] 8.2 Add `scripts/deploy.sh <tag> [--instance-id ...]` as a thin SSM wrapper that sends `sudo -n /opt/messycrm/deploy.sh <tag>` to the environment's instance and prints the command id and status — the same host helper GitHub Actions invokes; verify a second invocation with an older published tag serves that revision, a new tag serves the new bundle hash under `/static/crm/assets/`, and the wrapper's exit code is non-zero when the remote command fails
- [ ] 8.3 Write `infra/terraform/README.md` with the bootstrap order per workspace (`workspace new` → `apply` → `set-secrets.sh` → `push-image.sh` → `deploy.sh`), the required AWS permissions, a variable table generated from `variables.tf`, the snapshot-before-`destroy` warning, the secret-rotation-restarts-the-host note, the local-state and two-workspace caveats, and the out-of-scope list (TLS, ALB, RDS, CI); verify every command in the README runs as written against the deployed environment in both workspaces

## 9. Integration verification

- [x] 9.1 From a clean state (`terraform destroy` then `apply`), follow the README bootstrap order end to end and confirm `curl -fsS http://<eip>/` returns the dashboard HTML with a hashed asset reference and that a write command (status change) redirects and renders a flash message — proving the public-address and CSRF requirements
- [ ] 9.2 Prove data persistence: create a contact, `terraform apply -replace` the instance (or stop and start with a replacement), then confirm the contact is still listed after the host comes back on the same Elastic IP
- [ ] 9.3 Confirm idempotence and teardown: a second `terraform apply` plans zero changes, then `terraform destroy` leaves no EC2 instance, Elastic IP, EBS volume, ECR repository, secret container, or log group (`aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=<project>` returns only expected resources)

## Workflow follow-up

- Archive the change after review of the planning artifacts.
- Verify the archived specs under `openspec/specs/aws-deployment/` match the deployed behaviour.
