#!/usr/bin/env python3
"""Consistent local backup with an isolated restore and hash verification."""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

root = Path('/opt/umx-configurator-app')
backup_dir = root / 'backups'
backup_dir.mkdir(mode=0o700, exist_ok=True)
os.umask(0o077)
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
archive = backup_dir / f'catalog-{stamp}.tar.gz'

def manifest(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob('*') if p.is_file()}

with tempfile.TemporaryDirectory(dir=backup_dir) as temporary:
    staging = Path(temporary) / 'data'
    staging.mkdir()
    subprocess.run(['docker', 'pause', 'umx-configurator-app'], check=True, stdout=subprocess.DEVNULL)
    try:
        with sqlite3.connect(f'file:{root}/data/app.sqlite?mode=ro', uri=True) as source:
            with sqlite3.connect(staging / 'app.sqlite') as target:
                source.backup(target)
        for name in ('models', 'catalog-assets'):
            shutil.copytree(root / 'data' / name, staging / name)
    finally:
        subprocess.run(['docker', 'unpause', 'umx-configurator-app'], check=True, stdout=subprocess.DEVNULL)
    hashes = manifest(staging)
    with tarfile.open(archive, 'w:gz') as output:
        output.add(staging, arcname='data')
    restored = Path(temporary) / 'restored'
    with tarfile.open(archive) as source:
        source.extractall(restored, filter='data')
    assert manifest(restored / 'data') == hashes, 'Restore hash mismatch'
    with sqlite3.connect(restored / 'data/app.sqlite') as database:
        assert database.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    (backup_dir / f'catalog-{stamp}.manifest.json').write_text(json.dumps(hashes, indent=2))
# Retain the seven most recent successful local backups.
for old in sorted(backup_dir.glob('catalog-*.tar.gz'))[:-7]:
    old.unlink()
    old.with_name(old.name.replace('.tar.gz', '.manifest.json')).unlink(missing_ok=True)
print(f'Backup and isolated restore verified: {archive.name}; {len(hashes)} files')
