#!/bin/sh
set -e

PUID=${PUID:-10001}
PGID=${PGID:-10001}

if [ "$(id -u golf)" != "$PUID" ] || [ "$(id -g golf)" != "$PGID" ]; then
  groupmod -o -g "$PGID" golf
  usermod -o -u "$PUID" golf
fi

chown -R golf:golf /app/data

exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
