"""
Lab helper: one MAC claims multiple IPs → ARP poisoning alert.

  python test_arp_poisoning.py
  python simulate_tests.py poison   # same, with auto target pick
"""

from __future__ import annotations

import argparse
import sys

from simulate_tests import cmd_poison
from test_common import DEFAULT_API


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate ARP poisoning attack.")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--rounds", type=int, default=4)
    args = parser.parse_args()
    return cmd_poison(args.api, args.rounds)


if __name__ == "__main__":
    sys.exit(main())
