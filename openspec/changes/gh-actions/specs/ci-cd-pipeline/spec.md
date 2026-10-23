# Spec Delta

## Purpose

Define the automated path from a commit to a running revision: what must pass before code
can merge, how a validated artifact reaches each deployed environment, how a production
release is cut, and how the pipelines obtain cloud credentials.

## ADDED Requirements

### Requirement: Every change is gated by deterministic checks

Each pull request targeting `development` or `main` SHALL validate the workflow definitions
first, then run backend linting, a static security analysis of the backend, a migration drift
check, Django's system check and the Django test suite, and the frontend test suite, type
check and production build. A failing check MUST block merge.

#### Scenario: Lint failure is blocked
- **WHEN** a pull request introduces a Python lint or formatting error
- **THEN** the lint check reports failure and the pull request cannot be merged

#### Scenario: Failing test is blocked
- **WHEN** a pull request introduces a failing Django test
- **THEN** the test check reports failure and the pull request cannot be merged

#### Scenario: Broken frontend change is blocked
- **WHEN** a pull request fails the frontend tests, the type check, or the bundle build
- **THEN** the build check reports failure and the pull request cannot be merged

#### Scenario: Model change without a migration is blocked
- **WHEN** a pull request changes a model field without adding a migration
- **THEN** the migration drift check reports failure

#### Scenario: Security weakness is blocked
- **WHEN** a pull request adds backend code that the static security analysis reports at the configured severity threshold
- **THEN** the lint job reports failure and the pull request cannot be merged

#### Scenario: A waived finding needs a reason in the code
- **WHEN** a reported finding is intentionally suppressed
- **THEN** the suppression is a per-line annotation naming the rule and a justification, visible in review, rather than a global configuration exclusion

#### Scenario: Security analysis reports its findings in the run
- **WHEN** the static security analysis runs for a pull request
- **THEN** the run output lists the severity, rule, and file for every finding, or reports that none were found

#### Scenario: Malformed workflow is blocked
- **WHEN** a pull request edits a workflow file with an invalid expression or syntax
- **THEN** the workflow lint job reports failure and the remaining checks do not start

#### Scenario: Checks run without cloud credentials
- **WHEN** the checks run for a pull request
- **THEN** no cloud credentials are requested and no deployment step executes

### Requirement: The integration branch deploys to the dev environment automatically

Every merge to `development` that passes the checks SHALL build one container image, publish
it, deploy it to the `dev` environment, and confirm the environment serves the application.

#### Scenario: Merge to development reaches dev
- **WHEN** a commit lands on `development` with green checks
- **THEN** an image is published, the dev host is instructed to run that image tag, and the dev URL returns the dashboard

#### Scenario: A failed gate stops the dev deployment
- **WHEN** any check fails for a commit pushed to `development`
- **THEN** no image is published and no host command is issued for that commit

#### Scenario: Image is identified by the commit
- **WHEN** a deploy completes for a commit
- **THEN** the deployed tag is derived from that commit and the published image's digest is reported in the run summary

#### Scenario: Unhealthy deploy is rolled back
- **WHEN** the dev deployment's post-deploy check fails
- **THEN** the job reports failure and the previously deployed tag is restored on the host

### Requirement: Production deploys the artifact that dev validated, after approval

A deployment to `prod` SHALL reuse the image digest deployed to `dev` for the same commit
rather than rebuilding it, and MUST NOT start until the `Production` environment's approval
rules are satisfied.

#### Scenario: Promotion keeps the same digest
- **WHEN** the same commit is deployed to `dev` and then to `prod`
- **THEN** both environments run the identical image digest

#### Scenario: Approval is required
- **WHEN** a commit merges to `main` while the `Production` environment has required reviewers
- **THEN** the pipeline waits for approval before any prod-side image push or host command

#### Scenario: Rejection stops the promotion
- **WHEN** the required reviewer rejects the pending deployment
- **THEN** no image is published to the prod registry and the prod host is unchanged

#### Scenario: A failed gate stops the promotion
- **WHEN** the checks for the commit reaching `main` are not all successful
- **THEN** the promotion does not start and neither registry nor host is touched

#### Scenario: Promotion without a dev build is refused
- **WHEN** a commit reaches `main` with no image published for it from `development`
- **THEN** the deploy job fails with an explicit "no validated artifact" error and touches neither environment

### Requirement: Production is verified and recoverable

A production deployment SHALL verify the environment after the host restart and MUST return
to the previous revision when verification fails.

#### Scenario: Successful production deployment is verified
- **WHEN** the prod host finishes starting the new image
- **THEN** the prod URL returns the dashboard and the deployed tag is recorded in the run summary

#### Scenario: Failed production deployment rolls back
- **WHEN** the prod post-deploy check fails
- **THEN** the previous prod tag is redeployed, the environment is re-checked, and the run fails

#### Scenario: Rollback is a single manual action
- **WHEN** an operator re-runs the deploy pipeline for an earlier commit that has a published image
- **THEN** that revision is deployed without rebuilding it or changing infrastructure

### Requirement: Releases are derived from commit messages and never redeploy

A production release SHALL be cut only after a successful `prod` deployment, SHALL derive the
version from Conventional Commits on `main`, and SHALL publish a version tag, a changed
`pyproject.toml`, a changelog entry, and a GitHub Release. The release actions MUST NOT
trigger another check or deployment run.

#### Scenario: Feature merge releases a minor version
- **WHEN** a `feat:` commit lands on `main` and its `prod` deployment succeeds
- **THEN** the version is bumped by a minor increment and a `vX.Y.Z` tag plus GitHub Release exist

#### Scenario: No releasable commit produces no release
- **WHEN** only `chore:` or `docs:` commits land on `main`
- **THEN** no tag, version bump commit, or GitHub Release is created and the deployment still succeeds

#### Scenario: Failed deployment releases nothing
- **WHEN** the `prod` deployment fails or is rolled back
- **THEN** no version is tagged and no GitHub Release is published

#### Scenario: The bump commit does not re-trigger the pipeline
- **WHEN** the release commits the version bump and tag to `main`
- **THEN** no new `ci.yml` run is started for that commit, so no gate and no deployment runs

#### Scenario: Released image carries the version
- **WHEN** a release is published for a commit
- **THEN** the prod registry contains the image for that commit under both its commit-derived tag and the released version tag

### Requirement: Cloud credentials are short-lived and environment-scoped

Deployment jobs SHALL obtain cloud credentials by exchanging a GitHub OIDC identity token for
an environment-scoped role and MUST NOT read long-lived access keys. Credentials for one
environment MUST NOT write to, or command the host of, the other; promotion may read the
other's registry.

#### Scenario: No static cloud keys exist
- **WHEN** the repository's secrets and the workflow files are searched for cloud access key material
- **THEN** no access key or secret key is present

#### Scenario: Dev role cannot deploy prod
- **WHEN** the dev deployment's credentials are used to publish to the prod registry or command the prod host
- **THEN** the cloud provider denies the request

#### Scenario: Promotion may read across environments
- **WHEN** the prod deployment's credentials pull the validated image digest from the dev registry
- **THEN** the pull is allowed, while pushing to the dev registry and commanding the dev host are both denied

#### Scenario: Environment identity is enforced by the trust policy
- **WHEN** a workflow run outside the configured environment attempts to assume a deploy role
- **THEN** the role assumption is denied

#### Scenario: Missing environment name is detected
- **WHEN** a workflow references an environment name that does not exist in the repository settings
- **THEN** the run fails fast with an explicit error instead of deploying without approval rules
