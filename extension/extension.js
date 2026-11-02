(() => {
  'use strict';
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const root = document.createElement('div');
  root.dataset.personaVisionSettings = 'true';
  root.style.cssText = 'display:block;min-width:0;flex-shrink:0';
  const shadow = root.attachShadow({ mode:'open' });
  shadow.innerHTML = `<style>
:host{font-family:var(--font-y2k,inherit);color:var(--foreground,#e8e2d4)}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid var(--primary,#bdb29a);outline-offset:2px}
#open{display:flex;align-items:center;gap:11px;width:100%;min-height:53px;padding:12px 18px;border:0;border-bottom:1px solid var(--border,#817d70);background:transparent;color:var(--foreground,#e8e2d4);text-align:left;font-size:14px;font-weight:600}
.open-icon{display:block;flex:none;width:19px;height:19px;opacity:.7}.title{flex:1}.chevron{width:9px;height:9px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);opacity:.65;transition:transform .15s}#open[aria-expanded="true"] .chevron{transform:rotate(225deg) translate(-2px,-1px)}
section{display:none;padding:14px 18px 18px;color:var(--foreground,#e8e2d4);border-bottom:1px solid var(--border,#817d70);font-size:13px}section.open{display:block}.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:42px;cursor:pointer}.toggle-copy{line-height:1.5}.toggle-copy small{display:block;color:var(--muted-foreground,#aaa598);font-size:11px;margin-top:3px}.switch{position:relative;display:inline-flex;flex:none}.switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}.track{display:block;width:40px;height:23px;border:1px solid var(--muted-foreground,#aaa598);border-radius:20px;background:var(--background,#171717);transition:background .15s}.track:after{content:'';display:block;width:15px;height:15px;margin:3px;background:var(--muted-foreground,#aaa598);border-radius:50%;transition:transform .15s,background .15s}.switch input:checked+.track{background:var(--primary,#e8e2d4)}.switch input:checked+.track:after{transform:translateX(17px);background:var(--primary-foreground,#171717)}.switch input:focus-visible+.track{outline:2px solid var(--primary,#bdb29a);outline-offset:3px}.switch input:disabled+.track{opacity:.5}
.note{display:flex;gap:7px;margin:10px 0 0;color:var(--muted-foreground,#aaa598);font-size:11.5px;line-height:1.65}.note-star{flex:none;opacity:.8}.note p{margin:0}#state,#error{margin:8px 0 0;font-size:11.5px;line-height:1.55}#state:empty,#error:empty{display:none}#error{color:var(--destructive,#d76a62);white-space:pre-wrap}
</style>
<button id="open" type="button" aria-expanded="false"><svg class="open-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4 3.1-6 7-6s6.4 2 7 6"/></svg><span class="title">프사 인식</span><span class="chevron" aria-hidden="true"></span></button>
<section aria-label="페르소나 프사 인식">
  <label class="toggle-row"><span class="toggle-copy">이 채팅방에서 프사 보내기<small>현재 선택한 페르소나의 프로필 이미지</small></span><span class="switch"><input type="checkbox" id="enabled"><span class="track" aria-hidden="true"></span></span></label>
  <div class="note"><span class="note-star" aria-hidden="true">✧</span><p>켜면 RP 요청마다 프사가 모델로 전송돼요.<br>이미지 입력 비용이 추가될 수 있어요.</p></div>
  <p id="state" aria-live="polite"></p><p id="error" role="alert"></p>
</section>
`;
  // Mount beside the current RP persona section. React may recreate the drawer,
  // so reattach only when that happens; never place a floating button on screen.
  function mountInChatSettings() {
    const persona = document.querySelector('.mari-chat-settings-drawer [data-chat-settings-section="roleplay-persona"]');
    if (!persona || !persona.parentElement) { if (root.isConnected) root.remove(); return; }
    const parent = persona.parentElement;
    if (root.parentElement !== parent || root.previousElementSibling !== persona) persona.insertAdjacentElement('afterend', root);
    root.style.order = persona.style.order;
  }
  let mountPending = false, disposed = false;
  const observer = new MutationObserver(() => {
    if (disposed || (root.isConnected && root.previousElementSibling?.matches('[data-chat-settings-section="roleplay-persona"]'))) return;
    if (mountPending) return;
    mountPending = true;
    requestAnimationFrame(() => { mountPending = false; if (!disposed) mountInChatSettings(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  mountInChatSettings();
  const q = (s) => shadow.querySelector(s), panel = q('section'), box = q('#enabled'), state = q('#state'), error = q('#error');
  const chatId = () => { try { return localStorage.getItem('marinara-active-chat-id') || ''; } catch { return ''; } };
  const request = (url, init) => (typeof host.fetch === 'function' ? host.fetch(url, init) : fetch(url, init));
  let renderedId = '', generation = 0;
  async function load() {
    const id = chatId(), seq = ++generation; renderedId = id; error.textContent = ''; state.textContent = '';
    if (!id) { box.disabled = true; box.checked = false; state.textContent = '먼저 채팅방을 열어 주세요.'; return; }
    box.disabled = true;
    try {
      const res = await request('/api/persona-vision/' + encodeURIComponent(id), { credentials:'same-origin' });
      if (!res.ok) throw Error('서버 패치를 찾을 수 없거나 접근할 수 없어요.');
      const data = await res.json(); if (seq !== generation || id !== chatId()) return;
      box.checked = !!data.enabled;
      if (data.patches?.app !== 'ok' || data.patches?.prompt !== 'ok') throw Error('서버 패치가 이 마리나라 버전에 적용되지 않았어요.');
      state.textContent = data.lastStatus === 'prepared' ? '최근 RP 요청에 프사를 준비했어요.' : data.lastStatus === 'no-image' ? '프사를 찾지 못했어요. 페르소나 이미지를 확인해 주세요.' : '';
      box.disabled = false;
    } catch (e) { if (seq === generation) error.textContent = e.message || '설정을 읽지 못했어요.'; }
  }
  q('#open').onclick = () => { panel.classList.toggle('open'); q('#open').setAttribute('aria-expanded', String(panel.classList.contains('open'))); if (panel.classList.contains('open')) void load(); };
  box.onchange = async () => {
    const id = chatId(); if (!id || id !== renderedId) return void load();
    const enabled = box.checked; box.disabled = true; error.textContent = '';
    try {
      const res = await request('/api/persona-vision/' + encodeURIComponent(id), { method:'PUT', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enabled}) });
      if (!res.ok) throw Error('설정을 저장하지 못했어요.');
    } catch (e) { error.textContent = e.message; box.checked = !enabled; }
    if (id === chatId()) box.disabled = false; else void load();
  };
  const timer = setInterval(() => { if (panel.classList.contains('open') && renderedId !== chatId()) void load(); }, 1000);
  host.onCleanup?.(() => { disposed = true; observer.disconnect(); clearInterval(timer); root.remove(); });
})();
