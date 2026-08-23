# Security Policy

## Supported version

Security fixes are applied to the current `main` branch while Extra Credit is under active version-1 development. There is no publicly hosted instance and no long-term-support release yet.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability-reporting form:

<https://github.com/aberson/extra-credit/security/advisories/new>

Include reproduction steps and the smallest fictional example needed. Never submit real child data, a profile file or recovery backup, a named worksheet, a session token, credential, secret, absolute local path, or other private machine detail. If a screenshot is necessary, create it from fictional data and inspect it before uploading.

## Security boundary

Extra Credit runs locally, binds only to `127.0.0.1`, has no CORS access, and sends profile data to no cloud service. Never forward ports `4310` or `4311`. Stop the server after use on a shared or untrusted computer.

The stopped plaintext config relies on filesystem permissions: owner-only mode `0600` is requested on POSIX systems, and Windows relies on the current account's access-control list. The running loopback API is not an OS-account boundary or authenticated vault. Any local process or OS user that can connect to it can forge browser headers, fetch the per-process token, and read or replace the profile file. V1 intentionally has no account, PIN, encryption key, or bootstrap secret.

The server owns only `config/children.local.json`, uses bounded fatal UTF-8 reads, rejects links and non-regular targets, requires strong ETag preconditions, and performs flushed atomic replacement. Eligible invalid-file recovery is explicit and backup-first. Future-version, oversized, and unsafe targets are preserved for manual handling. These measures reduce accidental corruption and browser attacks; they do not protect a compromised local account or machine.

Dependency installation and the explicit `npm --prefix frontend run security` audit contact the npm registry. Normal application runtime does not need internet access. See [PRIVACY.md](PRIVACY.md) for data minimization, residual-copy cleanup, and recovery details.
