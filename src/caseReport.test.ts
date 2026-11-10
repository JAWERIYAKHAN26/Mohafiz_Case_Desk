import test from 'node:test';
import assert from 'node:assert/strict';
import {caseReportHtml} from './caseReport';
import type {WorkbookCase} from './workbookData';
const item:WorkbookCase={source_sha256:'source',source_sheet:'B2B - 2025',source_row:8,case_id:'DUPLICATE',rider_phone:'001234',total_loss:'0',status:'Pending',description:'<script>alert(1)</script>'};
test('report escapes source markup and preserves identifiers, zero and phone leading zeros',()=>{
 const html=caseReportHtml(item,[],[],[]);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('001234'));assert.ok(html.includes('<td>0</td>'));assert.ok(html.includes('Source row 8'));
});
test('original notes and operational findings both appear in full',()=>{
 const text='Multiline findings\n'+('long findings '.repeat(4000));
 const html=caseReportHtml(item,[{source_note_id:1,source_cell:'AC8',source_column:'AC',author:'',note_text:text}],[],[{actor_name:'FSO',action:'report',body:'New field report',created_at:'2026-11-03'}]);
 assert.ok(html.includes(text));assert.ok(html.includes('New field report'));
});
test('unsafe evidence target remains escaped text, never an executable link',()=>{
 const html=caseReportHtml(item,[],[{source_link_id:1,source_ref:'AQ8',target:'javascript:alert(1)',display:'Evidence',location:null}],[]);
 assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('javascript:alert(1)'));
});
