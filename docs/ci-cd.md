# CI/CD

The pipeline is three stages: checks on every change, a dev deployment from
`development`, and a production promotion from `main` followed by a release.

```text
pull request -> development -> workflows -> lint | test | build -> deepseek-code-review
pull request -> main        -> workflows -> lint | test | build
push to development         -> workflows -> lint | test | build -> deploy       (Staging)
push to main                -> workflows -> lint | test | build -> deploy-prod  (Production, approval)
                                                                  |
                                                      release.yml (workflow_run)
```

`deploy-prod` intentionally does **not** depend on `deploy`: `deploy` is skipped
on `main`, and a skipped job in `needs` would skip its dependants too. The real
dependency is the artifact — the promotion job refuses to start unless
`messycrm-dev:sha-<short>` exists for the same commit.

## Checks

| Job | What it runs |
| --- | --- |
| `workflows` | `actionlint` over `.github/workflows/` |
| `lint` | `ruff check`, `ruff format --check`, `bandit -ll` |
| `test` | migration drift, `manage.py check`, Django tests (`DJANGO_DEBUG=true`) |
| `build` | frontend tests, `tsc --noEmit`, `vite build` |
| `deepseek-code-review` | DeepSeek review of the diff, after `lint`/`test`/`build`, pull requests only |

Required status-check names are `workflows`, `lint`, `test`, `build`; add
`deepseek-code-review` to the same list once `development` is protected. Pull
requests never request cloud credentials and never deploy.

## Automated review

`deepseek-code-review` runs on pull requests into `development` (or any branch
but `main`) and nowhere else — a push is not reviewed. It feeds
`git diff <base.sha>...<head.sha>` (truncated at 150 KB) to
`deepseek/deepseek-flash` through [pi](https://pi.dev), pointed at the
`django-reviewer` and `cdrf-expert` skills. Its findings are posted as a pull
request comment — edited in place on later pushes — and always to the step
summary. The job fails on `VERDICT: block`, or when the reviewer exits non-zero.

Blocking is reserved for correctness, security and data-loss risk; style that
`ruff` already enforces is out of scope. `DEEPSEEK_API_KEY` (repository secret)
is required:

```bash
gh secret set DEEPSEEK_API_KEY --body "<deepseek-api-key>"
```

`deploy` deliberately does **not** depend on the review: the review is a
pull-request gate. Without a required status check on `development` a red review
blocks nothing — a merge, and a direct push, still reach Staging.

## Agent fix

`agent-fix.yml` is dispatch-only and never deploys. It fixes review findings on
a branch, verifies them with the same checks as `lint`/`test`/`build`, then
commits `fix(agent): ...` and pushes, which starts a new CI run:

```bash
gh workflow run agent-fix.yml -f branch=development -f findings="<pasted findings>"
```

It refuses `main`, stops after `max_commits` (default 2) agent commits on top of
the branch so a reviewer that keeps finding something cannot loop, and refuses
to commit anything under `.github/`, `infra/`, `docker/`, `Dockerfile` or
`compose*.yml`. The push uses `AGENT_TOKEN`, not `GITHUB_TOKEN`: a workflow-token
push does not trigger the next run. The job sits in the `Agent` environment and
must stay the only place holding a write-capable token:

```bash
gh secret set AGENT_TOKEN --body "<fine-grained-pat>"
```

## Environments and variables

Both deploys authenticate with GitHub OIDC and a per-environment IAM role; no
static AWS keys exist in the repository.

| Branch | GitHub environment | Terraform workspace | ECR repository | Instance | URL |
| --- | --- | --- | --- | --- | --- |
| `development` | `Staging` | `dev` | `vars.ECR_REPOSITORY` | `vars.INSTANCE_ID` | `vars.APP_URL` |
| `main` | `Production` | `prod` | `vars.ECR_REPOSITORY` | `vars.INSTANCE_ID` | `vars.APP_URL` |

The promotion job additionally reads `vars.SOURCE_ECR_REPOSITORY` (the `dev`
repository) from the `Production` environment.

`infra/scripts/publish-outputs.sh <workspace>` copies Terraform outputs into those
variables. Publishing `prod` also writes the release job's repository-scoped
variables, because `release.yml` deliberately has no GitHub environment (a
second approval prompt to add a tag to an already-deployed image would be
noise):

| Repository variable | Source |
| --- | --- |
| `RELEASE_ROLE_ARN` | `prod` workspace `release_role_arn` |
| `RELEASE_ECR_REGISTRY` | `prod` workspace `ecr_registry` |
| `RELEASE_ECR_REPOSITORY` | `prod` workspace `ecr_repository_name` |
| `RELEASE_AWS_REGION` | `prod` workspace `aws_region` |

### Provisioning order

```bash
cd infra/terraform

# dev owns the account-wide GitHub OIDC provider; the flag is required, or a
# later apply plans to destroy it.
terraform workspace select dev
terraform apply -var environment=dev -var create_github_oidc_provider=true

terraform workspace select prod
terraform apply -var environment=prod -var create_github_oidc_provider=false

cd ../..
./infra/scripts/publish-outputs.sh dev prod
```

## Image flow

1. `deploy` builds one `linux/amd64` image from the `Dockerfile` and pushes
   `messycrm-dev:sha-<short>`. A re-run of the same commit reuses the tag; ECR
   repositories are `IMMUTABLE`.
2. `deploy-prod` resolves the source commit — the merged pull request's head
   SHA on a PR merge, otherwise the pushed commit — reads the digest of
   `messycrm-dev:sha-<source-short>`, pulls it, re-tags it into
   `messycrm-prod:sha-<main-short>`, and asserts the pushed manifest digest is
   unchanged. It never rebuilds.
3. `release.yml` adds `:<version>` to that same manifest after a successful
   production deploy. `aws ecr put-image` with the unchanged manifest is a
   metadata-only write: same digest, new tag, no layer upload.

## Promotion follows the pull request

GitHub's merge, squash and rebase buttons all create a new SHA on `main`, so
`sha-<main-short>` usually does not exist in `messycrm-dev`. `deploy-prod`
therefore asks the API which merged pull request produced the commit and
promotes the image `development` built for that pull request's head. The image
is re-tagged in `messycrm-prod` as `sha-<main-short>`, so `release.yml` still
finds it under the deployed commit, and the digest assertion proves no rebuild
happened.

A push to `main` with no associated pull request (for example a direct
fast-forward promotion) falls back to `sha-<main-short>`, which must already
exist. Either path refuses a missing source image with an explicit
`no validated artifact` error, touching neither the prod registry nor the host.
If a pull request was merged with an "update branch" commit that never reached
`development`, build that head on `development` first or re-run the promotion
for a commit that has a dev image.

## Release

`release.yml` runs through `workflow_run` after a successful `CI` run on
`main`, and only when that run was triggered by a push. `python-semantic-release`
reads Conventional Commits, bumps `pyproject.toml`, writes `CHANGELOG.md`,
commits with `chore(release): <version> [skip ci]`, tags `v<version>`, pushes,
and creates the GitHub Release. The `[skip ci]` keeps the bump commit from
retriggering CI or a deployment.

`RELEASE_TOKEN` is required once `main` is protected. It must be a fine-grained
PAT scoped to this repository with **Contents: write** (and no other
permissions), stored as a repository secret:

```bash
gh secret set RELEASE_TOKEN --body "<fine-grained-pat>"
```

The workflow falls back to `GITHUB_TOKEN` when the secret is absent, which is
enough while `main` is unprotected but cannot push to a protected `main`.
Rotate it by replacing the secret; no workflow change is required.

## Rollback

The pipeline rolls back automatically when the smoke test fails: it reads the
previous `IMAGE_TAG` from `/opt/messycrm/host.env` before deploying and runs the
same host helper with that tag.

Manually deploy an earlier published tag with the workspace that owns the host:

```bash
cd infra/terraform
terraform workspace select prod
cd ../..
./infra/scripts/deploy.sh sha-<short>
```

`infra/scripts/deploy.sh` is a thin SSM wrapper around the same `/opt/messycrm/deploy.sh`
the pipeline invokes, so manual and automated deploys cannot drift.

## Diagnostics

```bash
gh run list --workflow CI --limit 10
gh run view <run-id> --log
gh variable list --env Staging
gh variable list --env Production
gh secret list
```
