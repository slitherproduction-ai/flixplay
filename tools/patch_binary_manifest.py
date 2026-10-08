#!/usr/bin/env python3
"""Patch same-width Android version fields in a compiled AXML manifest."""

from __future__ import annotations

import argparse
import struct
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--old-name", required=True)
    parser.add_argument("--new-name", required=True)
    parser.add_argument("--old-code", required=True, type=int)
    parser.add_argument("--new-code", required=True, type=int)
    args = parser.parse_args()

    if len(args.old_name.encode()) != len(args.new_name.encode()):
        raise SystemExit("version names must have the same encoded width")

    data = args.manifest.read_bytes()
    old_name = args.old_name.encode()
    old_name_utf16 = args.old_name.encode("utf-16le")
    name_matches = data.count(old_name) + data.count(old_name_utf16)
    if name_matches < 1:
        raise SystemExit(f"version name {args.old_name!r} not found")

    old_code = struct.pack("<I", args.old_code)
    code_matches = data.count(old_code)
    if code_matches != 1:
        raise SystemExit(f"expected one versionCode match, found {code_matches}")

    patched = data.replace(old_name, args.new_name.encode())
    patched = patched.replace(old_name_utf16, args.new_name.encode("utf-16le"))
    patched = patched.replace(old_code, struct.pack("<I", args.new_code), 1)
    args.manifest.write_bytes(patched)
    print(f"patched versionName matches={name_matches}, versionCode matches={code_matches}")


if __name__ == "__main__":
    main()
