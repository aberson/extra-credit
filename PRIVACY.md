# Privacy

Extra Credit is a parent-facing application that runs on your own computer. Its source code is public, but version 1 is not a hosted service and has no account, cloud sync, analytics, advertising, telemetry, API key, runtime artificial intelligence, or background upload. At runtime, profile and worksheet data stay on the local machine and are not sent to the project maintainers or a third party.

Installing dependencies and deliberately running `npm --prefix frontend run security` can contact the npm registry. Those maintenance operations do not send the local profile document.

## Data kept by the application

The sole live durable user-data store is the plaintext, gitignored file `config/children.local.json`; an explicit recovery action can also create the residual backup copies described below. The live file may contain an optional nickname, age in years, a parent-confirmed presentation band and math capabilities, a review date, writing mode, and up to five broad interest tags. Worksheets and unsaved form state remain in memory and are not archived by the application. The browser does not use localStorage, sessionStorage, IndexedDB, the Cache API, a service worker, or another browser database for child data.

The application does not request a surname, legal name, exact birthdate, school, teacher, email address, location, photo, voice, diagnosis, score history, or behavioral history. Nicknames and interest tags are free text and can still contain sensitive details. Use a nickname and broad topics only; do not enter any of the information above. Unicode text support does not imply multilingual instructional support.

The online screen is intended for a parent or other grown-up; children interact with printed sheets. Extra Credit does not claim legal compliance for child-facing online use.

## Filesystem and running-server boundaries

When Extra Credit is stopped, normal filesystem access controls protect the plaintext JSON from direct reads. New and replaced files request owner-only `0600` mode on POSIX-style systems. Windows relies on the current OS account's access-control list. Anyone who can read that account's files or its backups can read their contents; v1 does not encrypt them.

The server binds only to `127.0.0.1` on fixed ports `4310` and `4311`. Loopback blocks network peers, but it is not an OS-account boundary. While the server is running, any local process or OS user that can reach port `4310` can forge browser headers, obtain the in-memory session token, and read or replace the config through the unauthenticated API even when direct filesystem permissions would block that user. Use a trusted machine and session, never forward either port, and stop the development or production process after use—especially on a shared or untrusted computer.

## Validation and recovery copies

The API accepts no path. The server reads only the fixed config target, rejects symbolic links and non-regular files, caps reads at 65,536 bytes, uses fatal UTF-8 decoding and strict versioned validation, and requires strong raw-byte ETag preconditions for saves. Writes use flushed atomic replacement. It does not automatically overwrite an unreadable, malformed, schema-invalid, newer-version, oversized, or unsafe target.

For a bounded regular file with invalid UTF-8, malformed JSON, or an invalid v1 schema, the explicit **Back up invalid file and replace** action first creates a byte-identical, exclusive sibling named like `children.local.json.invalid-YYYYMMDDTHHMMSSZ-1234abcd.bak`. Only after that backup is flushed does the server replace the live target. Newer schema versions are preserved for a future migration or manual action. Oversized, symbolic-link, and other non-regular targets are not read, hashed, backed up, or recoverable through the app. The app never automatically downloads an unreadable raw file.

The setup screen lets a parent download only their current unsaved, valid form state, after they accept a privacy warning, using the generic name `extra-credit-profile-backup.json`. Save that file outside the public repository.

## Deletion and manual cleanup

Deleting a profile changes only `config/children.local.json`. It does not remove invalid-file `.bak` siblings, manually downloaded profile backups, saved PDFs, screenshots, named worksheet copies created outside the app, or printed pages. Automatic discovery or deletion of those copies is outside v1.

To remove residual data, inspect the repository's `config/` directory and manually delete obsolete `.bak` files you recognize. Separately inspect the download folder, PDF destination, screenshot folder, backups, and physical storage you selected. The app uses generic worksheet and backup names; save exports outside the repository and protect or destroy them as you would any other child-related document.

Because the project has no hosted service or telemetry, the maintainers do not receive data to retrieve or delete. If reporting a bug or vulnerability, never attach a real profile, child data, a named worksheet, recovery backup, token, secret, or filesystem path. Follow [SECURITY.md](SECURITY.md) for private security reporting.
