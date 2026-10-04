export const gates={G0:['A01'],G1:['L07','L08'],G2:['A07'],G3:['W08','F06'],G4:['Q01','Q02','Q03','Q04','Q05','Q06','Q07','Q08']};
export function project(title,brief,agents){return {version:1,id:crypto.randomUUID(),title,brief,created:new Date().toISOString(),sources:[],evidence:[],tasks:Object.fromEntries(agents.map(a=>[a.agent_id,{state:'pending',runs:[],review:null}])),gates:{},events:[],usage:{input:0,output:0,unknown:0},experiences:[]};}
export function ready(p,a){return p.tasks[a.agent_id].state==='pending'&&a.dependencies.every(id=>p.tasks[id]?.state==='completed')&&(a.required_gates||[]).every(id=>p.gates[id]?.approved);}
export function percent(p){return Math.round(Object.values(p.tasks).filter(t=>t.state==='completed').length/44*1000)/10;}
export function validateOutput(o,p,a){
  const fail=m=>{throw Error(m);};
  const keys=['schema_version','project_id','agent_id','summary','evidence_refs','limitations','claims','unresolved_issues','payload'];
  if(!o||Object.keys(o).sort().join()!==keys.sort().join()||o.schema_version!=='1.0'||o.project_id!==p.id||o.agent_id!==a.agent_id)fail('角色输出信封不符合合同');
  if(typeof o.summary!=='string'||o.summary.trim().length<20)fail('摘要过短');
  for(const k of ['evidence_refs','limitations','claims','unresolved_issues'])if(!Array.isArray(o[k]))fail(k+' 必须是数组');
  if(!o.payload||Object.keys(o.payload).sort().join()!==[...a.required_payload].sort().join()||Object.values(o.payload).some(v=>typeof v!=='string'||!v.trim()))fail('payload 必须逐项符合角色合同');
  for(const k of ['limitations','unresolved_issues'])if(o[k].some(v=>typeof v!=='string'))fail(k+' 必须是字符串数组');
  const ids=new Set(p.evidence.map(e=>e.id)), seen=new Set();
  if(o.evidence_refs.some(id=>!ids.has(id)))fail('evidence_refs 必须引用现有 E- 证据卡，不能引用 S- 来源');
  for(const c of o.claims){
    if(!c||Object.keys(c).sort().join()!==['claim_id','text','evidence_ids','inference_level'].sort().join()||typeof c.claim_id!=='string'||!c.claim_id||seen.has(c.claim_id)||typeof c.text!=='string'||!c.text.trim()||!Array.isArray(c.evidence_ids)||!['direct','association','mechanistic','hypothesis','extrapolation'].includes(c.inference_level))fail('论断字段或推断层级无效');
    seen.add(c.claim_id);
    if(c.evidence_ids.some(id=>!ids.has(id))||(c.inference_level!=='hypothesis'&&!c.evidence_ids.length))fail('非假设论断需要有效证据');
    if(c.inference_level!=='hypothesis'&&c.evidence_ids.some(id=>p.evidence.find(e=>e.id===id).level==='metadata'))fail('题录不能支持实质性论断');
  }return o;
}
export function validateImport(p,agents){
  if(p?.version!==1||typeof p.id!=='string'||typeof p.title!=='string'||typeof p.brief!=='string'||!Array.isArray(p.sources)||!Array.isArray(p.evidence)||!Array.isArray(p.events)||!Array.isArray(p.experiences)||!p.usage||!p.gates)throw Error('备份格式无效');
  if(Object.keys(p.tasks||{}).sort().join()!==agents.map(a=>a.agent_id).sort().join())throw Error('备份必须包含完整 44 个角色');
  for(const a of agents){const t=p.tasks[a.agent_id];if(!['pending','running','awaiting_review','completed','failed','interrupted'].includes(t.state)||!Array.isArray(t.runs))throw Error('任务状态无效');if(t.output)validateOutput(t.output,p,a);if(t.state==='running')t.state='interrupted';}
  if(p.sources.some(s=>!/^S-/.test(s.id)||typeof s.text!=='string'||typeof s.sha256!=='string')||new Set(p.sources.map(s=>s.id)).size!==p.sources.length)throw Error('来源格式无效');
  if(p.evidence.some(e=>!/^E-/.test(e.id)||!p.sources.some(s=>s.id===e.source_id)||!['full_text','abstract','metadata'].includes(e.level)||typeof e.quote!=='string'||!e.quote||!p.sources.find(s=>s.id===e.source_id).text.includes(e.quote))||new Set(p.evidence.map(e=>e.id)).size!==p.evidence.length)throw Error('证据必须对应现有来源的原文');
  return p;
}
export function invalidate(p,agents,id){
  const affected=new Set([id]);let changed=true;while(changed){changed=false;for(const a of agents)if(!affected.has(a.agent_id)&&a.dependencies.some(x=>affected.has(x))){affected.add(a.agent_id);changed=true;}}
  // Gate changes can invalidate roles outside the direct dependency descendants.
  for(const a of agents)if((a.required_gates||[]).length)affected.add(a.agent_id);
  changed=true;while(changed){changed=false;for(const a of agents)if(!affected.has(a.agent_id)&&a.dependencies.some(x=>affected.has(x))){affected.add(a.agent_id);changed=true;}}
  for(const x of affected){p.tasks[x].state='pending';p.tasks[x].review=null;delete p.tasks[x].output;}p.gates={};return affected;
}
