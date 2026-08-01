"""Resolve Scapy/Npcap interface names on Windows (not IP addresses)."""

from __future__ import annotations

import re

from scapy.all import conf, get_if_addr, get_if_list

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def looks_like_ip(value: str) -> bool:
    return bool(_IP_RE.match(value))


def iface_for_ip(ip: str) -> str | None:
    for name in get_if_list():
        try:
            if get_if_addr(name) == ip:
                return name
        except Exception:
            continue
    return None


def iface_from_route(dest: str = "0.0.0.0") -> str | None:
    """
    Scapy route() returns:
      (dst_network, netmask, gateway, iface_name, src_ip)
    Index [1] is netmask — NOT the interface (common bug on Windows).
    """
    try:
        route = conf.route.route(dest)
        if len(route) >= 5:
            iface_name, src_ip = route[3], route[4]
            if iface_name and not looks_like_ip(str(iface_name)):
                return str(iface_name)
            if src_ip:
                by_ip = iface_for_ip(str(src_ip))
                if by_ip:
                    return by_ip
        if len(route) >= 4:
            iface_name = route[3]
            if iface_name and not looks_like_ip(str(iface_name)):
                return str(iface_name)
    except Exception:
        pass
    return None


def resolve_iface(target_ip: str | None = None) -> str | None:
    dest = target_ip or "0.0.0.0"
    found = iface_from_route(dest)
    if found:
        return found
    if target_ip:
        found = iface_from_route("0.0.0.0")
        if found:
            return found
    if conf.iface and not looks_like_ip(str(conf.iface)):
        return str(conf.iface)
    return None
