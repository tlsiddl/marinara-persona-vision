'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { registerHooks } = require('node:module');

const VERSION = '0.1.2';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const APP_ANCHOR = 'app.addHook("onRequest", androidLocalAuthHook);';
const PROMPT_ANCHOR = 'dedupeLastMessageWrappers(preparedMessagesForGen);';
const appInsert = '\n  globalThis.__personaVision.attach(app);';
const promptInsert = '\n          if (chatMode === "roleplay" && !input.impersonate) await globalThis.__personaVision.addImage(preparedMessagesForGen, { chatId: input.chatId, identity, dataDir: DATA_DIR });';
const DRY_ANCHOR = 'dedupeLastMessageWrappers(finalMessages);';
const DRY_INSERT = '\n    if (returnPrompt && chatMode === "roleplay" && !impersonate) finalMessages = await globalThis.__personaVision.previewMessages(finalMessages, { chatId, identity: persona, dataDir: (await import("../../utils/data-dir.js")).DATA_DIR, includeImages: true });';
const PEEK_ANCHOR = 'messages: toPeekPromptMessages(injectOwnerSpatialPrompt(assembled.messages, ownerSpatialProjection)),';
const PEEK_FALLBACK_ANCHOR = 'messages: toPeekPromptMessages(injectOwnerSpatialPrompt(messages, ownerSpatialProjection)),';
const PEEK_FALLBACK_REPLACEMENT = 'messages: toPeekPromptMessages(injectOwnerSpatialPrompt(chatMode === "roleplay" ? await globalThis.__personaVision.previewMessages(messages, { chatId: chat.id, identity, dataDir: DATA_DIR }) : messages, ownerSpatialProjection)),';
const PEEK_REPLACEMENT = 'messages: toPeekPromptMessages(injectOwnerSpatialPrompt(chatMode === "roleplay" ? await globalThis.__personaVision.previewMessages(assembled.messages, { chatId: chat.id, identity, dataDir: DATA_DIR }) : assembled.messages, ownerSpatialProjection)),';
const patches = { app: 'pending', prompt: 'pending' };
const lastStatus = new Map();

function patchSource(source, anchor, insertion) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) return null;
  return source.slice(0, first + anchor.length) + insertion + source.slice(first + anchor.length);
}
function settingsPath(dir) { return path.join(dir, 'persona-vision.json'); }
function readSettings(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath(dir), 'utf8'));
    return data && typeof data === 'object' && data.chats && typeof data.chats === 'object' ? data : { chats: {} };
  } catch { return { chats: {} }; }
}
function saveSetting(dir, id, enabled) {
  if (!VALID_ID.test(id) || typeof enabled !== 'boolean') throw new Error('Invalid setting');
  const data = readSettings(dir);
  if (enabled) data.chats[id] = true; else delete data.chats[id];
  fs.mkdirSync(dir, { recursive: true });
  const target = settingsPath(dir), tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, target);
}
function imageData(dir, avatarPath) {
  if (typeof avatarPath !== 'string') return null;
  const match = /^\/api\/avatars\/file\/([^/?#]+)(?:\?[^#]*)?$/.exec(avatarPath);
  if (!match) return null;
  let name;
  try { name = decodeURIComponent(match[1]); } catch { return null; }
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return null;
  try {
    const base = fs.realpathSync(path.join(dir, 'avatars'));
    const file = fs.realpathSync(path.join(base, name));
    if (path.dirname(file) !== base) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 12 || stat.size > MAX_IMAGE_BYTES) return null;
    const bytes = fs.readFileSync(file);
    let mime = null;
    if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
    else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
    if (!mime) return null;
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch { return null; }
}
async function addImage(messages, { chatId, identity, dataDir, preview = false, includeImages = true }) {
  if (!VALID_ID.test(chatId || '')) return;
  if (!readSettings(dataDir).chats[chatId]) { if (!preview) lastStatus.delete(chatId); return; }
  const image = imageData(dataDir, identity?.avatarPath);
  if (!image) { if (!preview) lastStatus.set(chatId, 'no-image'); return; }
  const msg = [...messages].reverse().find(m => m.role === 'user');
  if (!msg) { if (!preview) lastStatus.set(chatId, 'no-user-message'); return; }
  if (includeImages) msg.images = [...(msg.images || []), image];
  msg.content += '\n\n[참고 이미지: 이 이미지 한 장은 현재 사용자의 페르소나 프로필 사진이다. 페르소나의 외형을 참고하되, 현재 장면의 복장이나 행동으로 단정하지 마. 장면에 자연스럽게 필요할 때만 외형을 언급하고, 매 응답마다 반복해서 묘사하지 마.]';
  if (preview) msg.content += '\n[미리보기: 현재 설정에서 페르소나 프사가 요청에 포함될 예정입니다. 실제 전송 결과는 아닙니다.]';
  else lastStatus.set(chatId, 'prepared');
}
async function previewMessages(messages, options) {
  const copy = messages.map(message => ({...message, ...(message.images ? {images:[...message.images]} : {})}));
  await addImage(copy, {...options, preview:true, includeImages:options.includeImages === true});
  return copy;
}
async function getDataDir() {
  const entry = path.resolve(process.argv[1]);
  const mod = await import(pathToFileURL(path.join(path.dirname(entry), 'utils', 'data-dir.js')).href);
  return mod.DATA_DIR;
}
function attach(app) {
  app.register(async function (router) {
    router.get('/:id', async (req, reply) => {
      const id = req.params.id;
      if (!VALID_ID.test(id)) return reply.code(400).send({ error: 'Invalid chat id' });
      const dataDir = await getDataDir();
      return { enabled: !!readSettings(dataDir).chats[id], patches, lastStatus: lastStatus.get(id) || null, version: VERSION };
    });
    router.put('/:id', async (req, reply) => {
      const id = req.params.id, enabled = req.body?.enabled;
      if (!VALID_ID.test(id) || typeof enabled !== 'boolean') return reply.code(400).send({ error: 'Invalid setting' });
      saveSetting(await getDataDir(), id, enabled);
      if (!enabled) lastStatus.delete(id);
      return { enabled, patches };
    });
  }, { prefix: '/api/persona-vision' });
}
function install() {
  if (typeof registerHooks !== 'function') throw Error('Node 22.15 or newer is required');
  globalThis.__personaVision = { attach, addImage, previewMessages, patches };
  registerHooks({ load(url, context, nextLoad) {
    if (!url.startsWith('file:')) return nextLoad(url, context);
    const filename = fileURLToPath(url);
    const appFile = /[\\/]packages[\\/]server[\\/]dist[\\/]app\.js$/.test(filename);
    const promptFile = /[\\/]packages[\\/]server[\\/]dist[\\/]routes[\\/]generate\.routes\.js$/.test(filename);
    const dryFile = /[\\/]packages[\\/]server[\\/]dist[\\/]routes[\\/]generate[\\/]dry-run-route\.js$/.test(filename);
    const peekFile = /[\\/]packages[\\/]server[\\/]dist[\\/]routes[\\/]chats\.routes\.js$/.test(filename);
    if (!appFile && !promptFile && !dryFile && !peekFile) return nextLoad(url, context);
    const result = nextLoad(url, context);
    const source = result.source == null ? fs.readFileSync(filename, 'utf8') : Buffer.from(result.source).toString('utf8');
    const name = appFile ? 'app' : promptFile ? 'prompt' : dryFile ? 'dry-preview' : 'peek-preview';
    const anchor = appFile ? APP_ANCHOR : promptFile ? PROMPT_ANCHOR : dryFile ? DRY_ANCHOR : PEEK_ANCHOR;
    let patched;
    if (peekFile) {
      const first = source.indexOf(anchor);
      const fallbackCount = source.split(PEEK_FALLBACK_ANCHOR).length - 1;
      patched = first < 0 || source.indexOf(anchor, first + anchor.length) >= 0 || fallbackCount !== 2 ? null : (source.slice(0, first) + PEEK_REPLACEMENT + source.slice(first + anchor.length)).replaceAll(PEEK_FALLBACK_ANCHOR, PEEK_FALLBACK_REPLACEMENT);
    } else patched = patchSource(source, anchor, appFile ? appInsert : promptFile ? promptInsert : DRY_INSERT);
    patches[name] = patched ? 'ok' : 'failed';
    process.stderr.write(`[persona-vision] ${name}: ${patches[name]}\n`);
    return patched ? { ...result, source: patched, shortCircuit: true } : result;
  }});
}
if (process.env.PERSONA_VISION_TEST !== '1' && /[\\/]packages[\\/]server[\\/]dist[\\/]index\.js$/i.test(path.resolve(process.argv[1] || ''))) {
  try { install(); } catch (e) { process.stderr.write(`[persona-vision] disabled: ${e.message}\n`); }
}
module.exports = { VERSION, APP_ANCHOR, PROMPT_ANCHOR, appInsert, promptInsert, patchSource, imageData, addImage, previewMessages, readSettings, saveSetting, install, patches };
