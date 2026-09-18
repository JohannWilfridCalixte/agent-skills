"""Run repository-owned Python documentation examples and optional strict checking.

Python 3.12+; provide MYPY_PYTHONPATH for an existing cached mypy installation.
This harness intentionally runs trusted snippets in child processes. It creates no
runtime dependencies and never imports arbitrary external snippets.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / "skills/python-engineer/rules"


def snippet(filename: str, heading: str) -> str:
    section = (RULES / filename).read_text().split(heading, 1)[1]
    match = re.search(r"```python\n(.*?)\n```", section, re.DOTALL)
    if match is None:
        raise ValueError(f"No Python example under {heading}")
    return match.group(1)


def run(source: str, assertions: str) -> None:
    completed = subprocess.run(
        [sys.executable, "-B", "-c", source + "\n" + assertions],
        check=False, capture_output=True, text=True,
    )
    if completed.returncode:
        raise AssertionError(completed.stderr)


def main() -> None:
    decimal = snippet("types.md", "### Parameters: accept broad, return narrow")
    narrowing = snippet("types.md", "### TypeIs for narrowing")
    # The guide explicitly offers the stdlib import for Python 3.13+.
    if sys.version_info >= (3, 13):
        narrowing = narrowing.replace("from typing_extensions import TypeIs", "from typing import TypeIs")
    matching = snippet("match-exhaustiveness.md", "## Match Exhaustiveness")
    result = snippet("error-handling.md", "### Result pattern for domain logic")
    run(decimal, "assert total([]) == Decimal('0')\nassert isinstance(total([]), Decimal)\nassert total((Decimal('1.25'), Decimal('2.50'))) == Decimal('3.75')")
    run(narrowing, "assert first_upper([]) is None\nassert first_upper(['ok']) == 'OK'\nassert first_upper(['ok', 1]) is None\nassert first_upper(('a', 'b')) == 'A'")
    run(matching, "assert [describe(item) for item in Status] == ['User is active', 'User is inactive', 'User is suspended']")
    run(result, "assert describe_result(calculate(3)) == '6'\nassert describe_result(calculate(-1)) == 'Value must be nonnegative'")
    run("from __future__ import annotations\nfrom typing import get_type_hints\ndef value(item: int) -> str:\n    return str(item)", "assert get_type_hints(value) == {'item': int, 'return': str}")
    print("PASS: four extracted Python examples, empty/invalid/success cases")
    cached_path = os.environ.get("MYPY_PYTHONPATH")
    if cached_path:
        environment = {**os.environ, "PYTHONPATH": cached_path, "PYTHONDONTWRITEBYTECODE": "1"}
        for name, source in [("decimal", decimal), ("narrowing", narrowing), ("matching", matching), ("result", result)]:
            checked = subprocess.run(
                [sys.executable, "-B", "-m", "mypy", "--strict", "--python-version", "3.13", "--cache-dir", "/dev/null", "--no-incremental", "-c", source],
                env=environment, check=False, capture_output=True, text=True,
            )
            if checked.returncode:
                raise AssertionError(f"{name}: {checked.stdout}{checked.stderr}")
            print(f"PASS: strict mypy {name}")
        negative = "from typing import TypeIs\nfrom decimal import Decimal\ndef invalid(items: list[object]) -> TypeIs[list[str]]:\n    return all(isinstance(item, str) for item in items)\ndef total(items: list[Decimal]) -> Decimal:\n    return sum(items)\ndef _private(items: list[Decimal]):\n    return sum(items)\n"
        checked = subprocess.run(
            [sys.executable, "-B", "-m", "mypy", "--strict", "--python-version", "3.13", "--cache-dir", "/dev/null", "--no-incremental", "-c", negative],
            env=environment, check=False, capture_output=True, text=True,
        )
        for diagnostic in ["narrowed-type-not-subtype", "return-value", "no-untyped-def"]:
            if checked.returncode != 1 or diagnostic not in checked.stdout:
                raise AssertionError(f"Expected {diagnostic}: {checked.stdout}{checked.stderr}")
        print("PASS: negative TypeIs, Decimal and private-annotation fixtures fail for intended reasons")
    else:
        print("SKIP: strict checker; set MYPY_PYTHONPATH to an existing installation")


if __name__ == "__main__":
    main()
