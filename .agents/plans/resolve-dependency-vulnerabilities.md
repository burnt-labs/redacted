# Resolve redacted dependency vulnerabilities

## Goal

Remove every open Dependabot finding from the web application and clearance contract while preserving the existing Next.js, OpenNext, Abstraxion, Reclaim, and CosmWasm behavior.

## Approach

1. Upgrade the direct Next.js and ecosystem dependencies to maintained compatible releases, then refresh the full pnpm lockfile.
2. Trace any remaining vulnerable transitive packages to their direct consumers and use narrow pnpm overrides only where upstream ranges do not select patched versions.
3. If `image-size` remains and still has no patched upstream release, use the already validated repo-local parser patch with regression tests for both malformed-input advisories.
4. Refresh the clearance contract lockfile to Rand 0.8.6 without changing its public contract API.
5. Validate frozen installation, audit output, lint, production and Worker builds, contract tests, and the exact GitHub Actions paths before publication.

## Risk boundary

Do not change application functionality, authentication, chain configuration, contract messages, or deployment destinations. Dependency overrides must resolve to patched implementations and must not merely suppress audit findings.
