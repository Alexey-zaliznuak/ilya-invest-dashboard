from __future__ import annotations

from typing import Any
from urllib.parse import unquote, urlparse

from python_socks import ProxyType

# Совместимо с aheron messengers / telegram-proxy:
# - socks5://phone:pass@host:1080  (phone-прокси, предпочтительно для Telethon/MTProto)
# - http://user:pass@host:3128     (CONNECT, как TELEGRAM_HTTP_PROXY у Bot API)


_SCHEME_TO_TYPE = {
    "socks5": ProxyType.SOCKS5,
    "socks5h": ProxyType.SOCKS5,
    "socks4": ProxyType.SOCKS4,
    "socks4a": ProxyType.SOCKS4,
    "http": ProxyType.HTTP,
    "https": ProxyType.HTTP,
}


def parse_telegram_proxy_url(raw: str) -> dict[str, Any]:
    """Парсит URL прокси в dict для TelegramClient(proxy=...)."""
    text = raw.strip()
    if not text:
        raise ValueError("пустой URL прокси")

    parsed = urlparse(text)
    scheme = (parsed.scheme or "").lower()
    if scheme not in _SCHEME_TO_TYPE:
        raise ValueError(
            f"прокси: неподдерживаемая схема {scheme!r}, "
            "ожидается socks5:// или http://"
        )
    if not parsed.hostname:
        raise ValueError(f"прокси {text!r}: нужен host")
    if parsed.port is None:
        raise ValueError(f"прокси {text!r}: нужен port")

    proxy: dict[str, Any] = {
        "proxy_type": _SCHEME_TO_TYPE[scheme],
        "addr": parsed.hostname,
        "port": int(parsed.port),
        "rdns": True,
    }
    if parsed.username:
        proxy["username"] = unquote(parsed.username)
    if parsed.password:
        proxy["password"] = unquote(parsed.password)
    return proxy


def proxy_log_label(proxy: dict[str, Any] | None) -> str:
    if not proxy:
        return "direct"
    kind = proxy["proxy_type"]
    name = {
        ProxyType.SOCKS5: "socks5",
        ProxyType.SOCKS4: "socks4",
        ProxyType.HTTP: "http",
    }.get(kind, str(kind))
    return f"{name}://{proxy['addr']}:{proxy['port']}"
