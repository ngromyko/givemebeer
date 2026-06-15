#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/givmebeer"
APP_USER="givmebeer"
PORT="${PORT:-3015}"
BASE_PATH="/givmebeer"
PUBLIC_URL="${PUBLIC_URL:-http://78.46.200.74/givmebeer}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

apt-get update
apt-get install -y nginx curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

python3 - <<PY
from pathlib import Path
import re
p = Path("${APP_DIR}") / "index.html"
s = p.read_text(encoding="utf-8")
public = "${PUBLIC_URL}".rstrip("/")
s = re.sub(r"https://[^\"]+?trycloudflare\\.com", public, s)
s = re.sub(r"http://78\\.46\\.200\\.74/givmebeer", public, s)
p.write_text(s, encoding="utf-8")
PY

cat >/etc/systemd/system/givmebeer.service <<SERVICE
[Unit]
Description=Pivo Nesi game
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=BASE_PATH=${BASE_PATH}
ExecStart=/usr/bin/node ${APP_DIR}/server.mjs
Restart=always
RestartSec=3
User=${APP_USER}
Group=${APP_USER}

[Install]
WantedBy=multi-user.target
SERVICE

LOCATION_BLOCK=$(cat <<NGINX
    # BEGIN givmebeer
    location = /givmebeer {
        return 301 /givmebeer/;
    }

    location /givmebeer/ {
        proxy_pass http://127.0.0.1:${PORT}/givmebeer/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    # END givmebeer
NGINX
)

TARGET_CONF=""
if [[ -f /etc/nginx/sites-available/linkink-landing ]]; then
  TARGET_CONF="/etc/nginx/sites-available/linkink-landing"
elif [[ -f /etc/nginx/sites-available/default ]]; then
  TARGET_CONF="/etc/nginx/sites-available/default"
else
  TARGET_CONF="/etc/nginx/sites-available/givmebeer"
  cat >"${TARGET_CONF}" <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
}
NGINX
  ln -sf "${TARGET_CONF}" /etc/nginx/sites-enabled/givmebeer
fi

python3 - <<PY
from pathlib import Path
conf = Path("${TARGET_CONF}")
block = """${LOCATION_BLOCK}
"""
s = conf.read_text()
start = s.find("    # BEGIN givmebeer")
end = s.find("    # END givmebeer")
if start != -1 and end != -1:
    end = s.find("\\n", end)
    if end == -1:
        end = len(s)
    s = s[:start] + s[end+1:]
insert = s.rfind("\\n}")
if insert == -1:
    raise SystemExit(f"Cannot find server block end in {conf}")
s = s[:insert] + "\\n" + block + s[insert:]
conf.write_text(s)
PY

systemctl daemon-reload
systemctl enable givmebeer
systemctl restart givmebeer
nginx -t
systemctl reload nginx

echo "Deployed Пиво неси"
echo "URL: ${PUBLIC_URL}/"
