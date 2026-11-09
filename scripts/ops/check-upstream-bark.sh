#!/bin/sh
set -eu

UPSTREAM_REPO=${UPSTREAM_REPO:-https://github.com/DuarteSantos8/openGym.git}
UPSTREAM_REF=${UPSTREAM_REF:-refs/heads/main}
STATE_FILE=${STATE_FILE:-/var/lib/opengym-upstream-watch/last-seen}
REPO_DIR=${REPO_DIR:-/var/lib/opengym-upstream-watch/upstream.git}
BARK_ENDPOINT=${BARK_ENDPOINT:-https://api.day.app/push}

: "${BARK_KEY:?BARK_KEY is required}"

mkdir -p "$(dirname "$STATE_FILE")"
if [ ! -d "$REPO_DIR/objects" ]; then
  git init --bare "$REPO_DIR" >/dev/null
  git -C "$REPO_DIR" remote add upstream "$UPSTREAM_REPO"
fi
git -C "$REPO_DIR" fetch --quiet --filter=blob:none --no-tags upstream "$UPSTREAM_REF"
commit=$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)

if [ ! -f "$STATE_FILE" ]; then
  printf '%s\n' "$commit" > "$STATE_FILE"
  exit 0
fi

previous=$(sed -n '1p' "$STATE_FILE")
[ "$previous" = "$commit" ] && exit 0

subjects=$(git -C "$REPO_DIR" log --format='%s' "$previous..$commit")
files=$(git -C "$REPO_DIR" diff --name-only "$previous" "$commit")

summary=$(SUBJECTS="$subjects" FILES="$files" python3 -c '
import os
from collections import Counter

subjects = [line for line in os.environ.get("SUBJECTS", "").splitlines() if line]
files = [line for line in os.environ.get("FILES", "").splitlines() if line]

prefixes = (
    ("fix", "修复"), ("feat", "新增功能"), ("docs", "文档更新"),
    ("chore", "维护调整"), ("test", "测试更新"), ("ci", "持续集成调整"),
    ("refactor", "代码重构"), ("perf", "性能优化"), ("build", "构建调整"),
    ("security", "安全修复"), ("revert", "回滚调整"),
)

def category(subject):
    lower = subject.lower().strip()
    for prefix, label in prefixes:
        if lower.startswith(prefix + ":") or lower.startswith(prefix + "("):
            return label
    return "其他更新"

def area(filename):
    if filename.startswith("api/"):
        return "API"
    if filename.startswith("frontend/"):
        return "前端"
    if filename.startswith("catalogue/"):
        return "动作目录"
    if filename.startswith(("docs/", "README", "CHANGELOG")):
        return "文档"
    if filename.startswith((".github/", ".gitlab/", "scripts/")):
        return "构建与运维"
    if filename in ("package.json", "package-lock.json") or filename.endswith("/package.json") or filename.endswith("/package-lock.json"):
        return "依赖配置"
    return "其他文件"

categories = Counter(category(subject) for subject in subjects)
areas = Counter(area(filename) for filename in files)
cat_text = "、".join(f"{name}{count}项" for name, count in categories.most_common()) or "未分类更新"
area_text = "、".join(f"{name}{count}个文件" for name, count in areas.most_common()) or "文件范围待同步时核对"
lines = [
    f"上游 main 有 {len(subjects)} 个新提交，涉及 {len(files)} 个文件。",
    f"更新内容：{cat_text}。",
    f"变更范围：{area_text}。",
    "请告诉我“同步 openGym 上游并部署”，我会先检查差异、测试并备份后再更新。",
]
print("\n".join(lines))
')

title='openGym 上游更新'
body="$summary"

# Send JSON through stdin so the Bark key never appears in the process list.
payload=$(BARK_KEY="$BARK_KEY" TITLE="$title" BODY="$body" python3 -c '
import json
import os
print(json.dumps({
    "device_key": os.environ["BARK_KEY"],
    "title": os.environ["TITLE"],
    "body": os.environ["BODY"],
    "sound": "alarm",
}, ensure_ascii=False))
')
printf '%s\n' "$payload" |
  curl --fail --silent --show-error --max-time 20 \
    -H 'Content-Type: application/json' \
    --data-binary @- "$BARK_ENDPOINT" >/dev/null

tmp="$STATE_FILE.tmp.$$"
printf '%s\n' "$commit" > "$tmp"
mv -f "$tmp" "$STATE_FILE"
