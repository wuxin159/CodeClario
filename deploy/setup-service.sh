#!/usr/bin/env bash
# First installation for the Ubuntu server layout described in README.md.
# Secrets are entered interactively and saved only outside the repository.
set +x
set -euo pipefail

app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
node_bin=/opt/codeclario/runtime/node/bin/node
env_file=/etc/codeclario.env
unit_file=/etc/systemd/system/codeclario.service
data_dir=/var/lib/codeclario

fail() { printf '%s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail '请使用root运行首次安装脚本。'
[[ $app_dir == /opt/codeclario/app ]] || fail '源码需要位于/opt/codeclario/app。'
[[ -x $node_bin ]] || fail '没有找到已安装的独立Node.js。'
[[ -f $app_dir/dist/index.html ]] || fail '前端尚未构建，请先执行npm run build。'

for target in "$env_file" "$unit_file" "$data_dir"; do
  if [[ -e $target || -L $target ]]; then
    fail "目标已存在，保留原状并停止：$target。请先检查，不要重复初始化。"
  fi
done
if getent passwd codeclario >/dev/null; then
  fail 'codeclario系统账户已存在，保留原账户并停止，请先检查。'
fi
if ss -H -ltn '( sport = :3000 )' | grep -q .; then
  fail '3000端口已被占用，请先确认现有服务。'
fi
docker image inspect codewise-runner:teaching-v2 >/dev/null

printf '请输入DeepSeek API Key（不回显，输入后按回车）：'
IFS= read -r -s codeclario_key </dev/tty
printf '\n'
if [[ ! $codeclario_key =~ ^sk-[A-Za-z0-9_-]+$ ]] ||
   (( ${#codeclario_key} < 12 || ${#codeclario_key} > 256 )); then
  unset codeclario_key
  fail '密钥格式不符合预期，尚未创建服务，请重新执行并输入。'
fi

printf '正在验证AI连接…\n'
DEEPSEEK_API_KEY="$codeclario_key" "$node_bin" --input-type=module <<'NODE'
try {
  const response = await fetch('https://api.deepseek.com/models', {
    headers: { Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  console.log('AI连接验证通过。');
} catch {
  console.error('AI连接验证失败，请检查密钥或服务器网络；尚未创建服务。');
  process.exitCode = 1;
}
NODE

useradd --system --user-group --no-create-home \
  --home-dir "$data_dir" --shell /usr/sbin/nologin codeclario
install -d -o codeclario -g codeclario -m 0750 "$data_dir"

(
  set -o noclobber
  umask 077
  {
    printf '%s\n' \
      'NODE_ENV=production' \
      'HOST=127.0.0.1' \
      'PORT=3000' \
      'DATABASE_PATH=/var/lib/codeclario/learning.sqlite' \
      'STATIC_DIR=dist' \
      'RUNNER_IMAGE=codewise-runner:teaching-v2' \
      'RUNNER_MAX_CONCURRENT=1' \
      'DEEPSEEK_BASE_URL=https://api.deepseek.com' \
      'DEEPSEEK_MODEL=deepseek-flash' \
      'SESSION_SECURE=true' \
      'TRUST_PROXY=loopback'
    printf 'DEEPSEEK_API_KEY=%s\n' "$codeclario_key"
  } > "$env_file"
)
unset codeclario_key

(
  set -o noclobber
  umask 022
  cat "$app_dir/deploy/codeclario.service" > "$unit_file"
)

systemd-analyze verify "$unit_file"
systemctl daemon-reload
systemctl enable --now codeclario.service

if ! "$node_bin" "$app_dir/deploy/check-service.mjs"; then
  systemctl --no-pager --full status codeclario.service || true
  journalctl -u codeclario.service -n 30 --no-pager || true
  exit 1
fi

systemctl is-active codeclario.service
printf '后台安装完成。接下来配置域名和HTTPS，再到网站注册账户。\n'
