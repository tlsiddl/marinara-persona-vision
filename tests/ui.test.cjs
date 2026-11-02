'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
test('UI reads current room, saves toggle and rechecks after a room change',async()=>{
  const els={}; for(const k of ['section','#enabled','#state','#error','#open','#close']) els[k]={textContent:'',checked:false,disabled:false,classList:{value:false,toggle(){this.value=!this.value},contains(){return this.value},remove(){this.value=false}}};
  const shadow={querySelector:s=>els[s],set innerHTML(v){this.html=v}};
  const root={style:{},attachShadow:()=>shadow,remove(){}};
  let id='room1', interval, cleanup; const calls=[];
  const context={document:{createElement:()=>root,body:{appendChild(){}}},localStorage:{getItem:()=>id},marinara:{fetch:async(url,opt)=>{calls.push({url,opt});return {ok:true,json:async()=>({enabled:false,patches:{app:'ok',prompt:'ok'}})}},onCleanup:f=>cleanup=f},setInterval:f=>(interval=f,1),clearInterval(){},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/extension.js'),'utf8'),context);
  els['#open'].onclick(); await new Promise(r=>setImmediate(r));
  assert.match(calls[0].url,/room1$/); assert.equal(els['#enabled'].disabled,false);
  els['#enabled'].checked=true; await els['#enabled'].onchange();
  assert.equal(calls[1].opt.method,'PUT'); assert.equal(JSON.parse(calls[1].opt.body).enabled,true);
  id='room2'; interval(); await new Promise(r=>setImmediate(r));
  assert.match(calls[2].url,/room2$/); assert.equal(els['#enabled'].checked,false);
  cleanup();
});
