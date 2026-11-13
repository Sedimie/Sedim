# Security Policy

Sedim stamps authentication and other security-sensitive code into real projects, so we take security reports seriously, both in the CLI and in the code it stamps.

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability.

Report it privately through one of:

- GitHub private vulnerability reporting: the "Report a vulnerability" button under the repository's Security tab.
- Email: siddharthb@fossunited.org

Include, where possible:

- What is affected (the CLI, a specific module, or the stamped output).
- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- The version or commit you tested against.

We will acknowledge your report, keep you updated on the fix, and credit you when it ships unless you prefer to stay anonymous.

## Scope

In scope:

- The `@sedim/cli` engine.
- Module source that gets stamped into user projects (for example the auth module under `packages/auth/`).
- The stamped output being insecure by default (weak crypto defaults, missing checks, unsafe wiring).

Out of scope:

- Vulnerabilities in a user's own project code after they have edited the stamped files.
- Vulnerabilities in third-party dependencies (report those upstream; tell us if Sedim pins an insecure version).

## A note on the stamping model

Because stamped code is owned and edited by the user, a report is most useful when it identifies an insecure default or pattern in what Sedim produces, so we can fix it at the source and every future stamp benefits.
