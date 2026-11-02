'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
test('compose install preserves memory NODE_OPTIONS and existing files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-install-'));
  try {
    const bin = path.join(root,'bin'), project = path.join(root,'project');
    fs.mkdirSync(bin); fs.mkdirSync(project);
    const original = path.join(project,'docker-compose.yml');
    fs.writeFileSync(original,'services:\n  marinara:\n    image: existing\n');
    const mock = `#!/usr/bin/env bash\nif [ "$1" = ps ]; then echo engine-marinara-1; elif [ "$1" = inspect ]; then case "$3" in *working_dir*) echo "$TEST_PROJECT";; *config_files*) echo "$TEST_PROJECT/docker-compose.yml";; *service*) echo marinara;; *Config.Env*) echo 'NODE_OPTIONS=--require=/app/memory-module/marinara-memory-runtime.cjs';; esac; elif [ "$1" = compose ]; then printf '%s\\n' "$*" >> "$TEST_PROJECT/calls"; else exit 1; fi\n`;
    fs.writeFileSync(path.join(bin,'docker'), mock, {mode:0o755});
    const result = spawnSync('bash', [path.resolve(__dirname,'../install.sh')], {encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,TEST_PROJECT:project}});
    assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readFileSync(original,'utf8'),'services:\n  marinara:\n    image: existing\n');
    const override=fs.readFileSync(path.join(project,'docker-compose.persona-vision.yml'),'utf8');
    assert.match(override,/memory-module\/marinara-memory-runtime\.cjs/);
    assert.match(override,/persona-vision\/persona-vision\.cjs/);
    assert.match(fs.readFileSync(path.join(project,'calls'),'utf8'),/config -q/);
    assert.match(fs.readFileSync(path.join(project,'calls'),'utf8'),/up -d --no-deps --force-recreate marinara/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
