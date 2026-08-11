# Security patch provenance

This directory is derived from the published `image-size` 1.2.1 npm artifact:

- Tarball: `https://registry.npmjs.org/image-size/-/image-size-1.2.1.tgz`
- Integrity: `sha512-rH+46sQJ2dlwfjfhCyNx5thzrv+dtmBIhPHk0zgRUukHzZ/kRueTJXoYYsclBaKcSMBWuGbOFXtioLpzTb5euw==`
- npm shasum: `ee118aedfe666db1a6ee12bed5821cde3740276d`
- Upstream git commit: `a4178fbb334ddb22d94cb4228ed597c24fd02e10`

The local package reports version `2.0.3-burnt.1` so dependency scanners can
distinguish it from affected upstream releases while preserving the 1.2.1
file-path API required by Metro. No patched upstream release supports that API.

The runtime deltas from the artifact are limited to:

1. Reject zero-length, truncated, and out-of-bounds ICNS entries for
   `GHSA-w3rx-r6r6-pgpr`, while passing the actual file length through bounded
   file reads and ignoring an entry header split by the 512 KiB read cap.
2. Reject ISO BMFF boxes smaller than their header, support validated 64-bit
   extended sizes, and use the parsed header size in HEIF, JP2, and JXL offsets
   for `GHSA-5p2g-fcmc-qvqq`.

Packaging-only deltas set the Burnt version, include this provenance file,
remove upstream development scripts and dependencies, and remove one vendored
CLI lint directive. There are no other runtime changes.

`../../scripts/check_image_size_security.js` verifies the installed package is
the repo-local build, byte-compares every changed runtime file with this
directory, and covers the malformed-input cases. The Expo Android export covers
Metro file-path compatibility.
