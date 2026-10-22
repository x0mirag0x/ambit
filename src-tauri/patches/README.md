# Patched Rust crates

## `tauri-plugin-updater`

Vendored copy of crates.io `tauri-plugin-updater` 2.10.1 with one change:
`zip` dependency raised from `^4` to `^9` so Windows update extraction uses a
release that closes RUSTSEC-2026-0367, RUSTSEC-2026-0368, and RUSTSEC-2026-0369.

`ZipArchive::extract` and `zip::result::ZipError` stay compatible, so updater
behavior is unchanged. The package is wired through `[patch.crates-io]` in
`src-tauri/Cargo.toml`.

Remove this directory and the patch entry once crates.io publishes a 2.x updater
that already depends on `zip ^9`.
