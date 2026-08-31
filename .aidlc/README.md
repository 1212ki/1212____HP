# Pinned AI-DLC Rules

This directory vendors the official AI-DLC rule payload used by 1212HP.

- Source and immutable provenance: `SOURCE.lock`
- Vendored payload: `aidlc-rules/`
- Per-file integrity manifest: `aidlc-rules.MANIFEST.sha256`
- Local integrity and repository integration: `scripts/aidlc-verify.sh --local`
- Live official-source authenticity and byte comparison: `scripts/aidlc-verify.sh --source`

The upstream core workflow does not replace repository-local governance. `AGENTS.md`, `CLAUDE.md`, `docs/DOCS_RULES.md`, security rules, and owner-only merge/deploy gates remain authoritative.

Local integrity success does not prove source authenticity. Before publishing this setup or a later payload update, live verification must resolve the official release tag to the locked commit, match official asset metadata and published digest, verify the downloaded official tag-archive SHA-256, and inspect the release ZIP before extraction. The accepted ZIP entries are exactly the manifest-listed regular files plus their required parent directories under `aidlc-rules/`; root extras, unlisted entries, symlinks, and other entry types fail closed. The safely extracted regular-file path set and bytes must then match the vendored payload exactly.

To update the payload, use a new official release asset, verify its GitHub-published digest and tag-archive digest, inspect the full accepted payload diff, regenerate the manifest and lock, and run both verification modes. Never track an upstream branch silently. The annotated tag is not claimed to have a cryptographic signature; this limitation remains explicit.
