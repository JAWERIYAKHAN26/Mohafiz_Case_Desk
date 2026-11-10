import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,type LiveMessage} from './liveOperations';
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
