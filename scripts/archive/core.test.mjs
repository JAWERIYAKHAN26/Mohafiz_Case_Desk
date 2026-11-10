import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,spreadsheet,storeAndVerify} from './core.mjs';
const snapshot={cases:[{case_id:'=SUM(1,2)',phone:'00123',findings:'<&"',recovered:'',null_value:null}],notes:[],links:[],field_reports:[]};
test('spreadsheet uses string cells, escapes XML and retains leading zeros',()=>{const text=spreadsheet(snapshot).toString();assert.ok(text.includes('ss:Type="String">00123'));assert.ok(text.includes('&lt;&amp;&quot;'));assert.ok(text.includes('=SUM(1,2)'));assert.ok(!text.includes('ss:Formula'));});
test('long findings and notes are split without cutting Unicode characters',()=>{const data={...snapshot,cases:[{findings:'😀'.repeat(20000)}]};const text=spreadsheet(data).toString();assert.ok(text.includes('Long text'));assert.equal((text.match(/😀/gu)||[]).length,20000);});
test('readback corruption prevents success',async()=>{const storage={upload:async()=>({}),download:async()=>({data:new Blob(['bad'])})};await assert.rejects(storeAndVerify(storage,'test',Buffer.from('original'),'text/plain'),/checksum mismatch/);});
test('retry accepts existing bytes only when hash and length match',async()=>{const bytes=Buffer.from('saved');const storage={upload:async()=>({error:{message:'exists'}}),download:async()=>({data:new Blob([bytes])})};const receipt=await storeAndVerify(storage,'test',bytes,'text/plain');assert.equal(receipt.sha256,digest(bytes));assert.equal(receipt.bytes,5);});
test('failed readback prevents success',async()=>{const storage={upload:async()=>({}),download:async()=>({error:{message:'failed'}})};await assert.rejects(storeAndVerify(storage,'test',Buffer.from('saved'),'text/plain'),/readback failed/);});
