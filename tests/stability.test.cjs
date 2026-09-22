const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {riverDelta}=require('../public/stability-core.js');
const point=(minutes,value)=>({t:new Date(Date.UTC(2026,8,18,12)+minutes*60000).toISOString(),v:value});
test('river: missing, malformed and distant readings never become one-hour zero changes',()=>{
  assert.equal(riverDelta([]),null);
  assert.equal(riverDelta([point(0,1)]),null);
  assert.equal(riverDelta([point(0,1),point(120,2)]),null);
  assert.equal(riverDelta([point(0,null),point(60,2)]),null);
  assert.equal(riverDelta([{t:'invalid',v:1},point(60,2)]),null);
});
test('river: irregular valid intervals have explicit duration and support corrected values',()=>{
  assert.deepEqual(riverDelta([point(65,1.5),point(0,1)]),{value:.5,minutes:65});
  assert.deepEqual(riverDelta([point(0,1.5),point(60,1.5)]),{value:0,minutes:60});
  assert.equal(riverDelta([point(0,1),point(44,2)]),null);
  assert.equal(riverDelta([point(0,1),point(76,2)]),null);
});
function builder(result,calls=[]){
  let proxy;proxy=new Proxy({}, {get(_,key){
    if(key==='then')return (resolve,reject)=>Promise.resolve(typeof result==='function'?result(calls):result).then(resolve,reject);
    return (...args)=>{calls.push([key,...args]);return proxy;};
  }});return proxy;
}
function frontend(db){
  const element={addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},setAttribute(){}};
  const storage=new Map();
  const context=vm.createContext({supabase:{createClient:()=>db},console:{warn(){},error(){}},setTimeout,clearTimeout,setInterval(){},URL,URLSearchParams,Date,Map,Set,Uint8Array,MonitoraCore:{riverDelta},
    navigator:{onLine:true,userAgent:''},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{querySelector:()=>element,querySelectorAll:()=>[],addEventListener(){},documentElement:element,body:element,readyState:'loading',visibilityState:'visible'},window:{addEventListener(){}},location:{href:'http://localhost/'}});
  let code=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  code=code.replace('initTheme();\nbootstrap();','');
  for(const file of ["auth.js","river.js","weather.js","push.js"])vm.runInContext(fs.readFileSync(path.join(root,"public",file),"utf8"),context);
  vm.runInContext(code,context);
  vm.runInContext('loadOccurrencePhotos=async()=>{};saveSnapshot=()=>{};renderConnection=()=>{};',context);
  return {context,run:code=>vm.runInContext(code,context)};
}
test('independent failures retain occurrences while alerts and recent reports update',async()=>{
  const queries=[];const db={from(table){const calls=[];queries.push({table,calls});return builder(steps=>{
    if(table==='occurrences'&&steps.some(x=>x[0]==='eq'&&x[2]==='active'))return {error:new Error('offline')};
    return {data:table==='alerts'?[{id:'new-alert'}]:[]};
  },calls);}};
  const app=frontend(db);
  app.run('state.occurrences=[{id:"saved"}];state.alerts=[{id:"old-alert"}];');
  await app.run('loadDataSafe()');
  assert.equal(app.run('state.occurrences[0].id'),'saved');
  assert.equal(app.run('state.alerts[0].id'),'new-alert');
  assert.equal(app.run('state.connectionDegraded'),true);
  assert.ok(queries[0].calls.some(x=>x[0]==='gt'&&x[1]==='expires_at'));
});
test('overlapping refreshes share one load and river failures keep saved measurements',async()=>{
  let calls=0;const app=frontend({from(){calls++;return builder({data:[]});},functions:{invoke:async()=>({error:new Error('offline')})}});
  await Promise.all([app.run('loadDataSafe()'),app.run('loadDataSafe()')]);
  assert.equal(calls,3);
  app.run('state.user={id:"test"};state.riverStatus={latest:{level_m:1.2},series:[{v:1.2}]};renderRiverStatus=()=>{};renderSources=()=>{};');
  await app.run('loadRiverStatus()');
  assert.equal(app.run('state.riverStatus.latest.level_m'),1.2);
  assert.equal(app.run('state.riverStatus.connection_state'),'unavailable');
});
function edge(slug,db,fetchImpl){
  let handler;
  const source=fs.readFileSync(path.join(root,'supabase/functions',slug,'index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
  const code=stripTypeScriptTypes(source,{mode:'strip'});
  const context=vm.createContext({createClient:()=>db,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn},crypto:globalThis.crypto,TextEncoder,Request,Response,URL,fetch:fetchImpl,setTimeout,clearTimeout,AbortController,console:{error(){}}});
  vm.runInContext(code,context);return handler;
}
const loginBody={action:'login',condominium_id:'test-unit',house_or_lot:'1',pin:'483927'};
const request=(body,headers={})=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('login missing account and wrong PIN have identical generic response',async()=>{
  for(const accounts of [[],[{auth_email:'test@example.test'}]]){
    const handler=edge('resident-access',{rpc:async()=>({data:0}),from:()=>builder({data:accounts}),auth:{signInWithPassword:async()=>({error:new Error('bad PIN')})}});
    const response=await handler(request(loginBody));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'INVALID_ACCESS'});
  }
});
test('rate limit denies before account lookup and fails closed on backend errors',async()=>{
  for(const [rpc,status] of [[async()=>({data:600}),429],[async()=>({error:new Error('database offline')}),503]]){
    let reads=0;const handler=edge('resident-access',{rpc,from(){reads++;throw Error('must not query');}});
    const response=await handler(request(loginBody));assert.equal(response.status,status);assert.equal(reads,0);
    if(status===429)assert.equal(response.headers.get('Retry-After'),'600');
  }
});
test('registration weak PIN returns validation instead of undefined-function failure',async()=>{
  const response=await edge('resident-access',{})(request({...loginBody,action:'register',pin:'123456'}));
  assert.equal(response.status,400);assert.equal((await response.json()).error,'PIN_WEAK');
});
test('river sync without secret cannot read or mutate monitoring tables',async()=>{
  let reads=0;const handler=edge('river-biguacu-sync',{rpc:async()=>({data:'server-only-secret'}),from(){reads++;throw Error('forbidden');}});
  const response=await handler(request({}));assert.equal(response.status,401);assert.equal(reads,0);
});
test('river sync deduplicates source timestamps, upserts corrections and records success',async()=>{
  const writes=[];const db={rpc:async()=>({data:'test-secret'}),from(table){return builder(steps=>{
    writes.push({table,steps});
    if(table==='river_sources')return {data:{id:'source',enabled:true,ingestion_enabled:true}};
    if(table==='river_sync_runs')return {data:{id:1}};
    if(steps.some(x=>x[0]==='select'))return {data:[{id:5,measured_at:'2026-09-18T15:00:00Z',level_m:1,precipitation_mm:null}]};
    return {data:null};
  });}};
  const row=(time,level,rain)=>({c:[{v:time},{v:level},{v:rain}]});
  const rows=[row('18/09/26 12:00',110,null),row('18/09/26 12:00',120,null),row('18/09/26 13:00',130,0),row('18/09/26 14:00','',null)];
  const handler=edge('river-biguacu-sync',db,async()=>new Response(JSON.stringify({rows})));
  const response=await handler(request({}, {'x-monitora-sync-secret':'test-secret'}));
  assert.equal(response.status,200);
  const upsert=writes.flatMap(w=>w.steps).find(s=>s[0]==='upsert');
  assert.equal(upsert[1].length,2);assert.equal(upsert[2].onConflict,'source_id,station_identifier,measured_at');
  assert.equal(upsert[1].find(x=>x.quality_status==='corrected').level_m,1.2);
  assert.ok(writes.some(w=>w.steps.some(s=>s[0]==='insert'&&s[1].status==='started')));
  assert.ok(writes.some(w=>w.steps.some(s=>s[0]==='update'&&s[1].status==='success')));
});
test('release version and service-worker shell match files',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.ok(html.includes(`v${require('../package.json').version}`),'displayed release matches package version');
  assert.ok(!/user-scalable=no|maximum-scale=1/.test(html));
  const sw=fs.readFileSync(path.join(root,'public/service-worker.js'),'utf8');
  const shell=JSON.parse(sw.match(/const APP_SHELL=(\[[\s\S]*?\]);/)[1]);
  for(const entry of shell){
    if(entry.startsWith('https://')){assert.match(entry,/@\d+\.\d+\.\d+/);continue;}
    assert.ok(fs.existsSync(path.join(root,'public',entry.split('?')[0])),entry);
  }
});
