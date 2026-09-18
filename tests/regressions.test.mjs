import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, after } from 'node:test';
import os from 'node:os';
import { validatePlan, planRevision, sealPlan, frontier, validateState, coverage, impact, saveState, resolveConfig, telemetry } from '../skills/use-workflow/scripts/agentic.mjs';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-regression-'));
after(() => fs.rmSync(scratch, {recursive:true,force:true}));
const plan = () => {
  const p = {schema_version:1,spec_id:'review',prd:'prd.md',technical_plan:'technical-plan.md',requirements:[{id:'AC-001',text:'Accept one effect',status:'active'},{id:'AC-002',text:'Display state',status:'active'}],tickets:[{id:'01',title:'Effect',path:'tickets/01.md',blocked_by:[],requirements:['AC-001'],files:['src/a.ts'],acceptance:['One effect']},{id:'02',title:'Display',path:'tickets/02.md',blocked_by:[],requirements:['AC-002'],files:['src/b.ts'],acceptance:['Current state displayed']}],decisions:[],artifacts:[]};
  p.revision=planRevision(p);return p;
};
const state = p => ({schema_version:2,state_version:0,workflow:'custom',run_id:'20260912-000000-abcd',topic:'review',output_path:'.agentic/output/run',started_at:'2026-09-12T00:00:00Z',updated_at:'2026-09-12T00:00:00Z',completed_at:null,status:'in_progress',current_step:1,steps_completed:[],technical_skills_prompt:[],execution_context:{commit_mode:'none'},repo:{root:scratch,branch:'review',base_sha:'a'.repeat(40),head_sha:'b'.repeat(40)},plan:{path:'plan.json',revision:p.revision,accepted_revision:p.revision},tickets:Object.fromEntries(p.tickets.map(t=>[t.id,{status:'ready',owner:null,plan_revision:p.revision,commit:null}])),gates:[{id:'approval',kind:'plan_acceptance',status:'approved',revision:p.revision,scope:['01','02'],evidence:'User approved both tickets'}],decisions:[],artifacts:{},checks:[],requirements:{},review_loops:{},history:{gates:[],checks:[],review_loops:[]},prs:{},knowledge:{},telemetry:{}});
test('same owned file under a dot alias is not accepted as independent work',()=>{
  const p=plan();p.tickets[1].files=['src/./a.ts'];p.revision=planRevision(p);
  const errors=validatePlan(p);assert.throws(()=>frontier(p,state(p)), /overlap/);
  assert.ok(errors.length>0);
});
test('completed state cannot accept checks for an older candidate',()=>{
  const p=plan(),s=state(p);s.status='completed';s.completed_at=s.updated_at;
  for(const t of Object.values(s.tickets))t.status='integrated';
  s.execution_context.candidate_revision='sha256:new-snapshot';
  s.checks=[{id:'full-suite',command:'node --test',required:true,status:'passed',revision:'sha256:old-snapshot',plan_revision:p.revision,exit_code:0,output_path:'checks.log',requirements:['AC-001','AC-002']}];
  for(const r of p.requirements)s.requirements[r.id]={status:'satisfied',evidence:[{check_id:'full-suite',criterion:r.text,revision:'sha256:old-snapshot'}]};
  const errors=validateState(s);
  assert.ok(errors.length>0);
});
test('state validation rejects omitted repository and version contracts',()=>{
  const s=state(plan());delete s.repo;delete s.state_version;s.steps_completed=[{step:1,name:'done',completed_at:'2026-09-12T00:00:00Z'},{step:1,name:'done again',completed_at:'2026-09-12T00:00:00Z'}];
  const errors=validateState(s);assert.ok(errors.length>0);
});
test('ticket prose changes stay affected when another ticket manifest changes',()=>{
  const directory=fs.mkdtempSync(path.join(scratch,'impact-'));fs.mkdirSync(path.join(directory,'tickets'));const p=plan();
  for(const f of [p.prd,p.technical_plan,...p.tickets.map(t=>t.path)])fs.writeFileSync(path.join(directory,f),'# Accepted behavior\n');
  const file=path.join(directory,'plan.json');fs.writeFileSync(file,JSON.stringify(p));sealPlan(file);const old=JSON.parse(fs.readFileSync(file));
  const next=structuredClone(old);next.tickets[0].title='Refined effect';fs.appendFileSync(path.join(directory,'tickets/02.md'),'Display a red warning when unavailable.\n');fs.writeFileSync(file,JSON.stringify(next));sealPlan(file);const changed=JSON.parse(fs.readFileSync(file));
  const result=impact(old,changed);assert.ok(result.affected_tickets.includes('02'));
});
test('state update preserves replaced failure in history',()=>{
  const directory=fs.mkdtempSync(path.join(scratch,'history-')),file=path.join(directory,'workflow-state.yaml'),s=state(plan());
  s.checks=[{id:'gate',command:'node --test',status:'failed',required:true,revision:'sha256:old',plan_revision:s.plan.revision,exit_code:1,output_path:'failed.log',requirements:['AC-001']}];const saved=saveState(file,s,{expected_version:null});
  const next=structuredClone(saved);next.checks=[];
  assert.throws(()=>saveState(file,next,{expected_version:saved.state_version}),/history|archiv|evidence/i);
});
test('archived receipts stay append-only across later saves',()=>{
  const directory=fs.mkdtempSync(path.join(scratch,'archive-')),file=path.join(directory,'workflow-state.yaml'),s=state(plan());
  const failure={id:'gate',command:'node --test',status:'failed',required:true,revision:'sha256:old',plan_revision:s.plan.revision,exit_code:1,output_path:'failed.log',requirements:['AC-001']};
  s.checks=[failure];const first=saveState(file,s,{expected_version:null});
  const archive={record:failure,archival_reason:'Superseded by current candidate verification',archived_at:'2026-09-12T00:00:00Z'};
  const second=saveState(file,{...first,checks:[],history:{...first.history,checks:[archive]}},{expected_version:1});
  for(const checks of [[],[{...archive,archival_reason:'Rewritten rationale'}]]) {
    assert.throws(()=>saveState(file,{...second,history:{...second.history,checks}},{expected_version:2}),/history|append|archiv/i);
  }
  const third=saveState(file,{...second,history:{...second.history,checks:[archive,{...archive,archival_reason:'Additional observation'}]}},{expected_version:2});
  assert.equal(third.state_version,3);
});
test('invalid configured model types cannot be returned for dispatch',()=>{
  assert.throws(()=>resolveConfig({version:'not-semver',ides:{codex:{models:{high_thinking:{model:{bad:'shape'},effort:19}}}}},{root:scratch,host:'codex',paths:[]}),/model|effort|version|config/i);
});
test('unavailable output token measurements do not become measured zero',()=>{
  const result=telemetry([{id:'one',run_id:'run',timestamp:'2026-09-12T00:00:00Z',type:'completion',input_tokens:100}]);assert.equal(result.tokens.output,null);
});
