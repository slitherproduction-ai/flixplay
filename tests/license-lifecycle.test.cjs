const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ts=require('typescript');
const tick=()=>new Promise(r=>setImmediate(r));
function moduleTS(file,imports){const source=fs.readFileSync(file,'utf8'),result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});assert(!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),file+' syntax');const m={exports:{}};vm.runInNewContext(result.outputText,{require:n=>imports[n]||{},exports:m.exports,module:m,Date,console,Map});return m.exports;}
(async()=>{
 for(const n of ['flixplay']){
  let raw=null;const secure={getItemAsync:async()=>raw,setItemAsync:async(k,v)=>{raw=v},deleteItemAsync:async()=>{raw=null}};
  const mod=moduleTS(path.join(__dirname,'..','services/device/licenseLifecycle.ts'),{'expo-secure-store':secure});
  const grant={state:'granted',canPlay:true,canConnect:true,licenseUntil:null,accessUntil:null};
  assert.equal(await mod.readLifecycleGrant('one'),null);await mod.saveLifecycleGrant('one',grant);assert.equal((await mod.readLifecycleGrant('one')).state,'granted');assert.equal(await mod.readLifecycleGrant('two'),null);
  let saved=JSON.parse(raw);saved.at=Date.now()-86400001;raw=JSON.stringify(saved);assert.equal(await mod.readLifecycleGrant('one'),null);
  await mod.saveLifecycleGrant('one',{...grant,licenseUntil:'2000-01-01T00:00:00Z'});assert.equal(await mod.readLifecycleGrant('one'),null);
  await mod.saveLifecycleGrant('one',grant);await mod.saveLifecycleGrant('one',{...grant,state:'blocked'});assert.equal(await mod.readLifecycleGrant('one'),null);
  let response={status:429,ok:false,payload:{error:'rate limited'}};
  class PortalRequestError extends Error{};
  const access=moduleTS(path.join(__dirname,'..','services/device/codeDeviceAccess.ts'),{'expo-constants':{default:{}},'react-native':{Platform:{OS:'android'}},'./portalClient':{PortalRequestError,requestPortal:async()=>response,portalServiceMessage:()=> 'temporary'}});
  for(const status of [429,500,503]){response.status=status;await assert.rejects(access.registerCodeDevice({macAddress:'test',deviceKey:'key'},'code'),e=>e.reason==='network');}
  response={status:200,ok:true,payload:{license:{can_play:false,status:'blocked'},code_access:{can_connect:false}}};assert.equal((await access.registerCodeDevice({macAddress:'test',deviceKey:'key'},'code')).state,'blocked');
  const component=fs.readFileSync(path.join(__dirname,'..','components/code-access-gate.tsx'),'utf8');const effect=component.slice(component.indexOf('  useEffect(() => {'),component.indexOf('  useEffect(() => {\n    if (!paymentOpen'));
  assert(!effect.includes('setInterval'));assert(effect.includes('previous !== "active"'));assert(component.includes('latestScope.current !== scope'));assert(!component.includes('NETWORK_GRACE_MS'));moduleTS(path.join(__dirname,'..','components/code-access-gate.tsx'),new Proxy({},{get:()=>({StyleSheet:{create:v=>v},Colors:{},Radii:{}})}));
  console.log(n+': lifecycle, secure cache TTL/expiry/scope/denial, transient HTTP failures OK');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
