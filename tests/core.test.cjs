'use strict';
process.env.PERSONA_VISION_TEST = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const p = require('../server/persona-vision.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-vision-'));
fs.mkdirSync(path.join(tmp, 'avatars'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXQAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(path.join(tmp, 'avatars', 'a.png'), png);
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
test('off by default, per-chat toggle survives reload', () => {
  assert.equal(p.readSettings(tmp).chats.room1, undefined);
  p.saveSetting(tmp, 'room1', true);
  assert.equal(p.readSettings(tmp).chats.room1, true);
  assert.equal(p.readSettings(tmp).chats.room2, undefined);
  assert.throws(() => p.saveSetting(tmp, '../bad', true));
});
test('only local, bounded, valid avatar assets', () => {
  assert.equal(p.imageData(tmp, '/api/avatars/file/a.png?v=2'), 'data:image/png;base64,' + png.toString('base64'));
  assert.equal(p.imageData(tmp, '/api/avatars/file/%2e%2e%2fa.png'), null);
  assert.equal(p.imageData(tmp, 'https://example.com/a.png'), null);
  fs.writeFileSync(path.join(tmp, 'avatars', 'fake.png'), 'not an image!');
  assert.equal(p.imageData(tmp, '/api/avatars/file/fake.png'), null);
});
test('only enabled room gets selected persona image without changing existing attachments', async () => {
  const identity = { avatarPath:'/api/avatars/file/a.png' };
  const msg = [{role:'user',content:'hello',images:['existing']},{role:'assistant',content:'a'}];
  await p.addImage(msg, {chatId:'room2',identity,dataDir:tmp});
  assert.deepEqual(msg[0].images, ['existing']);
  await p.addImage(msg, {chatId:'room1',identity,dataDir:tmp});
  assert.equal(msg[0].images.length, 2);
  assert.equal(msg[0].images[0], 'existing');
  assert.match(msg[0].content, /페르소나 프로필 사진/);
  p.saveSetting(tmp, 'room1', false);
  const newTurn = [{role:'user',content:'next'}];
  await p.addImage(newTurn, {chatId:'room1',identity,dataDir:tmp});
  assert.equal(newTurn[0].images, undefined);
});
test('source rewrite fails closed for missing or duplicate anchors', () => {
  assert.equal(p.patchSource('hello', 'missing', 'x'), null);
  assert.equal(p.patchSource('x x', 'x', 'y'), null);
  assert.equal(p.patchSource('abc', 'b', '!'), 'ab!c');
});
test('Node loader applies both hooks and actually passes image into prompt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-hook-'));
  try {
    const server = path.join(root, 'packages', 'server', 'dist');
    fs.mkdirSync(path.join(server, 'routes'), {recursive:true});
    fs.writeFileSync(path.join(server, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(server, 'app.js'), `export function go(app) { const androidLocalAuthHook = () => {}; app.addHook("onRequest", androidLocalAuthHook); }`);
    fs.writeFileSync(path.join(server, 'routes', 'generate.routes.js'), `export async function go(preparedMessagesForGen, identity, DATA_DIR) { const chatMode = 'roleplay', input = {chatId:'roomX',impersonate:false}; function dedupeLastMessageWrappers() {} dedupeLastMessageWrappers(preparedMessagesForGen); return preparedMessagesForGen; }`);
    const runner = path.join(root, 'run.cjs');
    fs.writeFileSync(runner, `const assert=require('node:assert/strict'); const pv=require(${JSON.stringify(path.resolve(__dirname,'../server/persona-vision.cjs'))}); pv.saveSetting(${JSON.stringify(tmp)},'roomX',true); let secondHookRan=false; require('node:module').registerHooks({load(u,c,next){const r=next(u,c);if(!u.endsWith('/generate.routes.js'))return r;const s=String(r.source).replace('return preparedMessagesForGen;', 'globalThis.secondHookRan=true; return preparedMessagesForGen;');return {...r,source:s,shortCircuit:true}}}); pv.install(); (async()=>{ let mounted=false; const app=await import(${JSON.stringify(require('node:url').pathToFileURL(path.join(server,'app.js')).href)}); app.go({addHook(){},register(){mounted=true}}); assert.equal(mounted,true); const route=await import(${JSON.stringify(require('node:url').pathToFileURL(path.join(server,'routes','generate.routes.js')).href)}); const result=await route.go([{role:'user',content:'hello'}],{avatarPath:'/api/avatars/file/a.png'},${JSON.stringify(tmp)}); assert.match(result[0].images[0], /^data:image\\/png;base64,/); assert.equal(globalThis.secondHookRan,true); assert.deepEqual(pv.patches,{app:'ok',prompt:'ok'}); })().catch(e=>{console.error(e);process.exitCode=1});`);
    const result = spawnSync(process.execPath, [runner], { encoding:'utf8', env:{...process.env, PERSONA_VISION_TEST:'1'} });
    assert.equal(result.status, 0, result.stderr);
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});
