#!/usr/bin/env bash
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
release=$(git -C "$repo" rev-parse HEAD)
target=${APP_SSH_HOST:-pve-141-docker-host}
ssh_args=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes)
if [[ -n ${APP_SSH_KNOWN_HOSTS:-} ]]; then ssh_args+=(-o "UserKnownHostsFile=$APP_SSH_KNOWN_HOSTS"); fi
if [[ -n $(git -C "$repo" status --porcelain --untracked-files=no) ]]; then
  echo 'Commit source changes before deployment.' >&2; exit 1
fi
root=/opt/umx-configurator-app
ssh "${ssh_args[@]}" "$target" "sudo install -d -o deploy -g deploy -m 0750 '$root' '$root/releases' '$root/releases/$release'"
git -C "$repo" archive HEAD | ssh "${ssh_args[@]}" "$target" "tar -xf - -C '$root/releases/$release'"
ssh "${ssh_args[@]}" "$target" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
root=/opt/umx-configurator-app
release=$1
candidate="$root/releases/$release"
previous=$(readlink "$root/current" || true)
sudo test -f "$root/.env"
sudo test -f "$root/data/app.sqlite"
compose() { sudo env APP_RELEASE="$release" docker compose -f "$candidate/compose.yaml" "$@"; }
compose config --quiet
compose build app
if [[ -n "$previous" ]]; then sudo python3 "$previous/scripts/backup.py"; fi
if ! compose up -d --no-deps --wait --wait-timeout 120 app; then
  if [[ -n "$previous" ]]; then
    sudo env APP_RELEASE="$(basename "$previous")" docker compose -f "$previous/compose.yaml" up -d --no-deps --wait app
  fi
  exit 1
fi
if [[ -n "$previous" ]]; then ln -sfn "$previous" "$root/previous"; fi
ln -sfn "$candidate" "$root/current"
curl --fail --silent http://127.0.0.1:3188/health
printf '\nDeployed revision %s\n' "$release"
REMOTE
