#!/usr/bin/env python3
"""Smoke-check the gmail-composer-drafter skill package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def check(skill_dir: Path) -> dict[str, object]:
    required = [
        skill_dir / "SKILL.md",
        skill_dir / "evals" / "evals.json",
        skill_dir / "references" / "composition-guide.md",
    ]
    missing = [str(path.relative_to(skill_dir)) for path in required if not path.exists()]
    return {
        "skill": skill_dir.name,
        "ok": not missing,
        "missing": missing,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-check gmail-composer-drafter files.")
    parser.add_argument("skill_dir", nargs="?", default=Path(__file__).resolve().parents[1])
    parser.add_argument("--format", choices=["json"], default="json")
    args = parser.parse_args()
    json.dump(check(Path(args.skill_dir)), fp=__import__("sys").stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
