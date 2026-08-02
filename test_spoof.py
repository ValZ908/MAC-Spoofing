"""
Lab helper: fake ARP reply → IP/MAC mismatch alert.

  python test_spoof.py
  python test_spoof.py --target-ip 10.10.0.106
  python simulate_tests.py spoof   # same, with auto target pick
"""

from __future__ import annotations

import argparse
import sys

from simulate_tests import cmd_spoof
from test_common import DEFAULT_API


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate IP/MAC mismatch attack.")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--target-ip", default=None)
    parser.add_argument("--rounds", type=int, default=5)
    args = parser.parse_args()
    return cmd_spoof(args.api, args.target_ip, args.rounds)


if __name__ == "__main__":
    sys.exit(main())
