import assert from 'node:assert/strict';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const engine=resolve(process.env.ENGINE_DIR || '../engine');
const dir=mkdtempSync(join(tmpdir(),'pv-app-'));
process.env.DATA_DIR=dir; process.env.FILE_STORAGE_DIR=join(dir,'storage');
process.env.NODE_ENV='test'; process.env.MARINARA_LITE='true'; process.env.LOG_LEVEL='silent'; process.env.PERSONA_VISION_TEST='1';
const require=createRequire(import.meta.url);
try { require('node:os').networkInterfaces(); } catch { require('node:os').networkInterfaces=()=>({}); syncBuiltinESMExports(); }
process.argv[1]=join(engine,'packages/server/dist/index.js');
const pv=require('../server/persona-vision.cjs'); pv.install();
const { buildApp }=await import(pathToFileURL(join(engine,'packages/server/dist/app.js')).href);
const app=await buildApp();
try {
  const get=()=>app.inject({method:'GET',url:'/api/persona-vision/test-room',headers:{host:'localhost'}});
  let r=await get(); assert.equal(r.statusCode,200,r.body); assert.equal(r.json().enabled,false);
  r=await app.inject({method:'PUT',url:'/api/persona-vision/test-room',headers:{host:'localhost'},payload:{enabled:true}});
  assert.equal(r.statusCode,200,r.body); assert.equal((await get()).json().enabled,true);
  r=await app.inject({method:'PUT',url:'/api/persona-vision/test-room',headers:{host:'localhost'},payload:{enabled:false}});
  assert.equal(r.statusCode,200,r.body); assert.equal((await get()).json().enabled,false);
  assert.equal(pv.patches.app,'ok');
  console.log('2.5.1 application settings API: off → on → off: PASS');
} finally { await app.close(); rmSync(dir,{recursive:true,force:true}); }
