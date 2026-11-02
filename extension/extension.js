(() => {
  'use strict';
  const host = typeof marinara === 'object' ? marinara : globalThis.marinara || {};
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;right:16px;bottom:185px;z-index:2147483000';
  const shadow = root.attachShadow({ mode:'open' });
  shadow.innerHTML = `<style>
    :host{--paper:#f5f1e6;--ink:#302d28;--muted:#716c60;--line:#b5aa90;--soft:#eae3d4;--night:#1b1b1a;--star:#c6b798;color-scheme:light;font-family:var(--mlh-serif, 'RIDIBatang','Noto Serif KR',Batang,'Times New Roman',serif)}
    :host-context([data-theme="dark"]),:host-context(.dark){--paper:#171717;--ink:#ece6d7;--muted:#b0aa9c;--line:#777166;--soft:#252420;--night:#111110;--star:#d2c4a5;color-scheme:dark}
    *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid var(--star);outline-offset:3px}
    #open{display:flex;align-items:center;gap:8px;min-height:42px;padding:0 16px 0 11px;border:1px solid var(--line);border-radius:22px;color:var(--ink);background:var(--paper);box-shadow:0 3px 12px #0004;font-size:13px;letter-spacing:.04em}
    .open-icon{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;font-size:15px;line-height:1}
    section{display:none;position:absolute;right:0;bottom:52px;width:min(320px,calc(100vw - 32px));max-height:min(560px,calc(100dvh - 220px));overflow:auto;color:var(--ink);background:var(--paper);border:1px solid var(--line);outline:1px solid var(--line);outline-offset:-5px;box-shadow:0 12px 35px #0005;line-height:1.55}
    section.open{display:block}.head{position:relative;overflow:hidden;padding:19px 21px 17px;color:#eae4d5;background:#171717;border-bottom:1px solid var(--line)}
    .head:after{content:'✦   ·      ✧        ·    ✦';position:absolute;right:-2px;top:4px;color:#e5dbc2;opacity:.28;font-size:11px;letter-spacing:4px;pointer-events:none}
    .eyebrow{display:block;font-family:Georgia,serif;font-size:9px;letter-spacing:.23em;color:#bcb29d;margin-bottom:6px}.heading{display:flex;align-items:center;gap:9px}.moon{display:grid;place-items:center;width:29px;height:29px;border:1px solid #8e877a;border-radius:50%;font-size:19px;line-height:1}.heading b{font-size:15px;font-weight:500;letter-spacing:.04em}
    .body{padding:18px 20px 16px}.section-label{font-family:Georgia,serif;color:var(--muted);font-size:10px;letter-spacing:.16em;margin-bottom:9px}.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 12px;border:1px solid var(--line);background:var(--soft);cursor:pointer}.toggle-copy{font-size:13px;line-height:1.5}.toggle-copy small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.switch{position:relative;display:inline-flex;flex:none}.switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}.track{display:block;width:38px;height:22px;border:1px solid var(--line);border-radius:12px;background:var(--paper);transition:background .15s}.track:after{content:'';display:block;width:14px;height:14px;margin:3px;background:var(--muted);border-radius:50%;transition:transform .15s,background .15s}.switch input:checked+.track{background:var(--ink)}.switch input:checked+.track:after{transform:translateX(16px);background:var(--paper)}.switch input:focus-visible+.track{outline:2px solid var(--star);outline-offset:3px}.switch input:disabled+.track{opacity:.5}
    .note{display:flex;gap:8px;margin:14px 1px 0;color:var(--muted);font-size:11.5px;line-height:1.7}.note-star{flex:none;color:var(--line)}#state,#error{margin:8px 0 0;font-size:11.5px;line-height:1.55}#state:empty,#error:empty{display:none}#error{color:#b74a43;white-space:pre-wrap}.footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding:10px 20px}.footer span{font-family:Georgia,serif;color:var(--muted);font-size:9px;letter-spacing:.16em}#close{border:0;background:transparent;color:var(--ink);padding:7px 0 7px 14px;font-size:12px}
    @media(max-height:400px){section{max-height:calc(100dvh - 70px)}}
  </style><button id="open" type="button" aria-expanded="false"><span class="open-icon" aria-hidden="true">☾</span><span>프사 인식</span></button><section aria-label="페르소나 프사 인식"><div class="head"><span class="eyebrow">PERSONA · VISION</span><div class="heading"><span class="moon" aria-hidden="true">☾</span><b>페르소나 프사 인식</b></div></div><div class="body"><div class="section-label">THIS CHAT</div><label class="toggle-row"><span class="toggle-copy">이 채팅방에서 프사 보내기<small>현재 선택한 페르소나</small></span><span class="switch"><input type="checkbox" id="enabled"><span class="track" aria-hidden="true"></span></span></label><div class="note"><span class="note-star" aria-hidden="true">✧</span><span>켜면 RP 요청마다 현재 페르소나 프사가 모델로 전송돼요. 이미지 입력 비용이 추가될 수 있어요.</span></div><p id="state" aria-live="polite"></p><p id="error" role="alert"></p></div><div class="footer"><span>✦ &nbsp; PERSONA VISION</span><button id="close" type="button">닫기</button></div></section>`;
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
  q('#open').onclick = () => { panel.classList.toggle('open'); q('#open').setAttribute('aria-expanded', String(panel.classList.contains('open'))); if (panel.classList.contains('open')) void load(); };
  q('#close').onclick = () => { panel.classList.remove('open'); q('#open').setAttribute('aria-expanded', 'false'); };
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
