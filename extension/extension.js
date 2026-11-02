(() => {
  'use strict';
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;right:16px;bottom:185px;z-index:2147483000;font:14px system-ui;color:#222';
  const shadow = root.attachShadow({ mode:'open' });
  shadow.innerHTML = `<style>button{font:inherit;cursor:pointer;border:0;border-radius:18px;padding:10px 14px;background:#6861ad;color:white;box-shadow:0 3px 12px #0003}section{display:none;position:absolute;right:0;bottom:48px;width:min(300px,85vw);padding:16px;border-radius:16px;background:white;box-shadow:0 5px 25px #0004;line-height:1.5}section.open{display:block}p{margin:8px 0}label{display:flex;gap:8px;align-items:center}small{color:#666}#error{color:#aa3030;white-space:pre-wrap}</style><button id="open">프사 인식</button><section><b>페르소나 프사 인식</b><p><label><input type="checkbox" id="enabled"> 이 채팅방에서 프사 보내기</label></p><small>켜면 RP 요청마다 현재 페르소나 프사가 모델로 전송돼요. 이미지 입력 비용이 추가될 수 있어요.</small><p id="state"></p><p id="error"></p><button id="close">닫기</button></section>`;
  document.body.appendChild(root);
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
  q('#open').onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) void load(); };
  q('#close').onclick = () => panel.classList.remove('open');
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
  host.onCleanup?.(() => { clearInterval(timer); root.remove(); });
})();
