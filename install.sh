#!/usr/bin/env bash
set -euo pipefail
# Docker Compose installation. Never edit the existing Compose files.
fail() { printf '[페르소나 프사] %s\n' "$*" >&2; exit 1; }
for command in docker python3 curl; do command -v "$command" >/dev/null || fail "$command 명령이 필요합니다."; done
if [ -n "${MARINARA_CONTAINER:-}" ]; then
  container="$MARINARA_CONTAINER"
else
  mapfile -t containers < <(docker ps --filter label=com.docker.compose.service=marinara --format '{{.Names}}')
  [ "${#containers[@]}" -eq 1 ] || fail '실행 중인 마리나라 컨테이너를 하나로 특정할 수 없습니다. MARINARA_CONTAINER=컨테이너이름을 지정해 주세요.'
  container="${containers[0]}"
fi
inspect_label() { docker inspect --format "{{index .Config.Labels \"$2\"}}" "$1"; }
project_dir="$(inspect_label "$container" com.docker.compose.project.working_dir)"
service="$(inspect_label "$container" com.docker.compose.service)"
configs="$(inspect_label "$container" com.docker.compose.project.config_files)"
[ -d "$project_dir" ] && [ -n "$service" ] && [ -n "$configs" ] || fail 'Compose 설정을 확인할 수 없습니다.'
opts="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" | sed -n 's/^NODE_OPTIONS=//p' | head -n 1)"
mkdir -p "$project_dir/persona-vision"
target="$project_dir/persona-vision/persona-vision.cjs"
script_source="${BASH_SOURCE[0]:-}"
script_dir=''
if [ -n "$script_source" ] && [ -f "$script_source" ]; then
  script_dir="$(cd "$(dirname "$script_source")" && pwd)"
fi
if [ -n "$script_dir" ] && [ -f "$script_dir/server/persona-vision.cjs" ]; then
  cp "$script_dir/server/persona-vision.cjs" "$target.tmp"
else
  curl --fail --location --silent --show-error 'https://raw.githubusercontent.com/tlsiddl/marinara-persona-vision/main/server/persona-vision.cjs' -o "$target.tmp"
fi
[ -s "$target.tmp" ] || fail '서버 패치를 받지 못했습니다.'
mv "$target.tmp" "$target"
case "$opts" in *'--require=/app/persona-vision/persona-vision.cjs'*) ;; *) opts="${opts:+$opts }--require=/app/persona-vision/persona-vision.cjs";; esac
override="$project_dir/docker-compose.persona-vision.yml"
export PV_TARGET="$target" PV_SERVICE="$service" PV_OPTIONS="$opts" PV_OVERRIDE="$override"
python3 - <<'PY'
import json, os
def q(s): return json.dumps(s.replace('$', '$$'), ensure_ascii=False)
content = 'services:\n  ' + q(os.environ['PV_SERVICE']) + ':\n    volumes:\n      - ' + q(os.environ['PV_TARGET'] + ':/app/persona-vision/persona-vision.cjs:ro') + '\n    environment:\n      NODE_OPTIONS: ' + q(os.environ['PV_OPTIONS']) + '\n'
file = os.environ['PV_OVERRIDE']
with open(file + '.tmp', 'w', encoding='utf-8') as out: out.write(content)
os.chmod(file + '.tmp', 0o600)
os.replace(file + '.tmp', file)
PY
args=()
IFS=',' read -ra config_list <<< "$configs"
for config in "${config_list[@]}"; do
  [ -n "$config" ] || continue
  [ "$config" = "$override" ] && continue
  [ -f "$config" ] || fail "Compose 파일을 찾지 못했습니다: $config"
  args+=(-f "$config")
done
args+=(-f "$override")
(cd "$project_dir" && docker compose "${args[@]}" config -q) || fail 'Compose 설정 검증에 실패했습니다. 기존 컨테이너는 변경하지 않았습니다.'
# The runtime is bind-mounted as a single file. Replacing it with mv changes its
# inode; a plain restart or unchanged compose up can keep the old mounted file.
(cd "$project_dir" && docker compose "${args[@]}" up -d --no-deps --force-recreate "$service") || fail '서버 재시작에 실패했습니다.'
printf '\n설치 완료. 앞으로 compose up을 직접 실행할 때 다음 파일을 함께 지정해야 합니다:\n'
printf '  docker compose'; printf ' %q' "${args[@]}"; printf ' up -d\n'
printf '기억 서재 등 기존 NODE_OPTIONS를 보존했습니다. 서버 로그에서 [persona-vision] app: ok 와 prompt: ok 를 확인하세요.\n'
