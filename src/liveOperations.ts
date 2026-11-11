export type LiveMessage={attachments?:{name:string;path:string;type:string}[];live_location?:{lat:number;lng:number;active:boolean;until:string;updated_at:string}|null;id:string;group_key:string;body:string;sender_id:string;sender_name:string;sender_role:string;created_at:string};
export function mergeMessages(previous:LiveMessage[],incoming:LiveMessage[]):LiveMessage[]{
 const map=new Map(previous.map(message=>[message.id,message]));
 for(const message of incoming)map.set(message.id,message);
 return [...map.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
export function databaseMessage(error:unknown):string {
 if(error&&typeof error==='object'&&'message' in error)return String(error.message)+('code' in error?` (${String(error.code)})`:'');
 return 'Could not connect. Please retry.';
}
export type WorkflowCounters={to_acknowledge:number;in_progress:number;updates_to_review:number;reports_to_review:number;unread_messages:number};

export function workflowStage(item:unknown):string|undefined {
 if(!item||typeof item!=='object'||!('case_workflow' in item))return;
 const linked=Array.isArray(item.case_workflow)?item.case_workflow[0]:item.case_workflow;
 if(linked&&typeof linked==='object'&&'stage' in linked&&typeof linked.stage==='string')return linked.stage;
}

export function formatCroCaseClosedMessage(caseId: string): string {
 return `Case ${caseId} has been closed by CRO.`;
}

export function formatSfsoAssignmentMessage(caseId: string, sfsoName: string, fsoName: string): string {
 return `Case ${caseId} is acknowledged by SFSO ${sfsoName} and assigned to FSO ${fsoName}.`;
}

export function formatSfsoAcknowledgeMessage(caseId: string, sfsoName: string): string {
 return `Case ${caseId} is acknowledged by SFSO ${sfsoName}. Ready for FSO assignment.`;
}

export function formatFsoAcknowledgeMessage(caseId: string, fsoName: string): string {
 return `Case ${caseId} acknowledged by FSO ${fsoName}. Dispatch started.`;
}
