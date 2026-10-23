# Spec Delta

## Purpose

Run the CRM application as a self-hosted, single-host deployment on AWS whose image,
configuration, data, public address, and logs are all managed as infrastructure: creatable
from code, re-deployable without reprovisioning, and destroyable without leaving billable
stragglers.

## ADDED Requirements

### Requirement: Application image is distributed from a private registry

The deployment SHALL run the application from a container image stored in a private registry
owned by the account. The host MUST NOT build the application image, and every deployed
revision MUST be referenced by an immutable tag rather than a floating tag.

#### Scenario: Host pulls the deployed revision
- **WHEN** the host starts the application stack
- **THEN** the web container image resolves to the registry-tagged revision recorded for the deployment and no local build step runs

#### Scenario: Registry is not public
- **WHEN** an unauthenticated client requests the application image from the registry
- **THEN** the registry denies access

#### Scenario: Rollback to a previous revision
- **WHEN** an operator re-deploys a previously published tag on the host
- **THEN** the running web container serves that earlier revision without any infrastructure change

### Requirement: Runtime configuration is resolved from a secret store at boot

The deployment SHALL supply the application secret key and database credentials from a
managed secret store when the host boots. Secret values MUST NOT be stored in the repository,
baked into the image, or written to infrastructure state or plan output.

#### Scenario: Secret values are not in the image
- **WHEN** the published image is inspected for environment defaults
- **THEN** it contains no application secret key and no database password

#### Scenario: Secrets are not readable from state
- **WHEN** infrastructure state and plan output are searched for the generated secret values
- **THEN** no plaintext secret value appears

#### Scenario: Host reads secrets with its own identity
- **WHEN** the host resolves its secrets at boot
- **THEN** the request is authorized by an instance-scoped identity that can read only this deployment's secret entries

### Requirement: Database data survives replacement of the host

Contact, activity, and user data SHALL live on a storage volume that is independent of the
host instance lifecycle, so the instance can be stopped, terminated, or replaced without
losing data.

#### Scenario: Host instance is replaced
- **WHEN** the host instance is destroyed and a new instance is attached to the retained data volume
- **THEN** previously stored contacts and activities are still present after the application starts

#### Scenario: Data volume is encrypted at rest
- **WHEN** the data volume is inspected
- **THEN** it reports encryption at rest enabled

#### Scenario: Database is not publicly reachable
- **WHEN** the host's public network interface is probed for the database port
- **THEN** the connection is refused because the database port is not exposed publicly

### Requirement: The application is reachable at a stable public address

The deployment SHALL expose the application over a public address that does not change when
the host instance is stopped and started, and the application MUST accept requests for that
address without host-header or CSRF rejections.

#### Scenario: Address is unchanged after a restart
- **WHEN** the host instance is stopped and started again
- **THEN** the public address that served the dashboard before the restart serves it again

#### Scenario: Dashboard loads from the public address
- **WHEN** a browser requests the dashboard root at the public address
- **THEN** the response is the CRM screen with its page payload and hashed assets, and no host or CSRF error

#### Scenario: Write commands work from the public address
- **WHEN** the dashboard submits a contact command from the public address
- **THEN** the command is accepted and the resulting redirect loads successfully

### Requirement: Application logs are retained centrally

Application output SHALL be shipped to a central log destination with a configured retention
period, so failures on the host can be diagnosed without logging into it.

#### Scenario: Startup output is available
- **WHEN** the host finishes booting the stack
- **THEN** the web process startup and any migration output are readable from the central log destination

#### Scenario: Retention is bounded
- **WHEN** the log destination's retention setting is inspected
- **THEN** it reports a finite retention period rather than "never expire"

### Requirement: Redeployment replaces the application without infrastructure changes

A redeploy SHALL switch the running revision by acting on the host alone, and MUST obtain
fresh registry credentials each time so a deploy long after boot still pulls successfully.

#### Scenario: Redeploy switches the revision
- **WHEN** a previously published tag is deployed on a running host
- **THEN** the host serves that revision and no infrastructure resource is created, replaced, or destroyed

#### Scenario: Redeploy after credentials expire
- **WHEN** a deploy runs more than a day after the host booted and its registry token has expired
- **THEN** the deploy still pulls the requested image and succeeds

#### Scenario: Deploy on a host that never finished bootstrapping
- **WHEN** a deploy targets a host whose configuration file was never written
- **THEN** the deploy fails with an explicit message instead of restarting the service with an unchanged tag

### Requirement: The environment is created and destroyed from code

The whole environment SHALL be derivable from versioned configuration, and destroying it
MUST remove every billable resource it created.

#### Scenario: Destroy removes billable resources
- **WHEN** the environment is destroyed
- **THEN** the host, the public address reservation, the registry repository, and the data volume no longer exist

#### Scenario: Missing required input fails before provisioning
- **WHEN** the environment is applied without a required input such as the project name
- **THEN** the run fails before creating any resource

#### Scenario: Outputs identify the applied environment
- **WHEN** outputs are read for a provisioned environment
- **THEN** they report that environment's registry, host, public URL, and log destination

### Requirement: Each environment is provisioned independently

The same versioned configuration SHALL produce a separate, isolated environment per
environment name, each with its own registry, host, public address, secret entries, and log
stream, and operating on one MUST NOT change the other.

#### Scenario: Two environments do not share resources
- **WHEN** two environments are provisioned from the same configuration
- **THEN** each has its own registry repository, host, public address, and data volume

#### Scenario: Destroying one environment leaves the other running
- **WHEN** one environment is destroyed while another exists
- **THEN** the remaining environment's host, address, and data are untouched

#### Scenario: Re-apply reports no drift
- **WHEN** the environment is applied twice with unchanged inputs
- **THEN** the second run plans zero changes
