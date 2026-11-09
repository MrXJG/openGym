#!/bin/sh
set -eu

UPSTREAM_REPO=${UPSTREAM_REPO:-https://github.com/DuarteSantos8/openGym.git}
UPSTREAM_REF=${UPSTREAM_REF:-refs/heads/main}
STATE_FILE=${STATE_FILE:-/var/lib/opengym-upstream-watch/last-seen}
BARK_ENDPOINT=${BARK_ENDPOINT:-https://api.day.app/push}

: "${BARK_KEY:?BARK_KEY is required}"

line=$(git ls-remote "$UPSTREAM_REPO" "$UPSTREAM_REF")
commit=$(printf '%s\n' "$line" | awk 'NF >= 2 { print $1; exit }')
case "$commit" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;;
  *) echo "unable to resolve $UPSTREAM_REPO $UPSTREAM_REF" >&2; exit 1 ;;
esac

mkdir -p "$(dirname "$STATE_FILE")"
if [ ! -f "$STATE_FILE" ]; then
  printf '%s\n' "$commit" > "$STATE_FILE"
  exit 0
fi

previous=$(sed -n '1p' "$STATE_FILE")
[ "$previous" = "$commit" ] && exit 0

title='openGym 上游有更新'
body=$(printf 'DuarteSantos8/openGym main 检测到新提交：%s；https://github.com/DuarteSantos8/openGym/commit/%s；请告诉我“同步 openGym 上游并部署”。' "$commit" "$commit")

# Send JSON through stdin so the Bark key never appears in the process list.
printf '{"device_key":"%s","title":"%s","body":"%s","sound":"alarm"}\n' \
  "$BARK_KEY" "$title" "$body" |
  curl --fail --silent --show-error --max-time 20 \
    -H 'Content-Type: application/json' \
    --data-binary @- "$BARK_ENDPOINT" >/dev/null

tmp="$STATE_FILE.tmp.$$"
printf '%s\n' "$commit" > "$tmp"
mv -f "$tmp" "$STATE_FILE"
