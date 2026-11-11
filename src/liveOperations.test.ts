import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeMessages,
  type LiveMessage,
  formatCroCaseClosedMessage,
  formatSfsoAssignmentMessage,
  formatSfsoAcknowledgeMessage,
  formatFsoAcknowledgeMessage,
} from './liveOperations';
import { workspaceGroups } from './workspaceGroups';

const message=(id:string,created_at:string,body=id):LiveMessage=>({id,created_at,body,group_key:'group:city:Islamabad',sender_id:'user',sender_name:'name',sender_role:'FSO'});
test('realtime event arriving before insert response remains a single saved message',()=>{
 const first=message('a','2026-11-03T10:00:00.000Z');
 const rows=mergeMessages([first],[first]);assert.equal(rows.length,1);assert.equal(rows[0].id,'a');
});
test('reconnect history and older pages preserve chronological order with stable ID ties',()=>{
 const rows=mergeMessages([message('b','2026-11-03T10:00:00Z')],[message('a','2026-11-03T10:00:00Z'),message('older','2026-11-02T10:00:00Z')]);
 assert.deepEqual(rows.map(row=>row.id),['older','a','b']);
});
test('saved database version replaces a duplicate without losing other messages',()=>{
 const rows=mergeMessages([message('a','2026-11-03T10:00:00Z','old'),message('b','2026-11-03T10:01:00Z')],[message('a','2026-11-03T10:00:00Z','saved')]);
 assert.equal(rows.length,2);assert.equal(rows[0].body,'saved');
});
test('automated messages format case closure for internal and client groups',()=>{
 const text = formatCroCaseClosedMessage('POS-ISL-OCT-26-1');
 assert.equal(text, 'Case POS-ISL-OCT-26-1 has been closed by CRO.');
});
test('automated messages format SFSO assignment and acknowledgement',()=>{
 const assignText = formatSfsoAssignmentMessage('POS-ISL-OCT-26-1', 'Sara Ahmed', 'Ali Raza');
 assert.equal(assignText, 'Case POS-ISL-OCT-26-1 is acknowledged by SFSO Sara Ahmed and assigned to FSO Ali Raza.');
 const ackText = formatSfsoAcknowledgeMessage('POS-ISL-OCT-26-1', 'Sara Ahmed');
 assert.equal(ackText, 'Case POS-ISL-OCT-26-1 is acknowledged by SFSO Sara Ahmed. Ready for FSO assignment.');
});
test('automated messages format FSO acknowledgement',()=>{
 const text = formatFsoAcknowledgeMessage('POS-ISL-OCT-26-1', 'Ali Raza');
 assert.equal(text, 'Case POS-ISL-OCT-26-1 acknowledged by FSO Ali Raza. Dispatch started.');
});
test('workspace groups map city and client company channels accurately',()=>{
 const croGroups = workspaceGroups({ role: 'CRO', city: 'Islamabad', company: '' });
 assert.ok(croGroups.some(g => g.key === 'group:city:Islamabad'));
 assert.ok(croGroups.some(g => g.key === 'group:company:PostEx'));
 const clientGroups = workspaceGroups({ role: 'Client', city: 'Karachi', company: 'PostEx' });
 assert.equal(clientGroups.length, 1);
 assert.equal(clientGroups[0].key, 'group:company:PostEx');
 const fsoGroups = workspaceGroups({ role: 'FSO', city: 'Rawalpindi', company: '' });
 assert.equal(fsoGroups.length, 1);
 assert.equal(fsoGroups[0].key, 'group:city:Islamabad');
});
