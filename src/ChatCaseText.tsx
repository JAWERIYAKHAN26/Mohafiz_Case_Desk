import {Fragment} from 'react';
import type {ReactNode} from 'react';
// Match server-generated Case IDs without treating call UUIDs or ordinary text as cases.
export default function ChatCaseText({text,onOpen,disabled=false}:{text:string;onOpen:(id:string)=>void;disabled?:boolean}){
 const token=/(@\[([^\]\n]{1,100})\]\(user:([0-9a-f-]{36})\))|(\b[A-Z]{2,12}-[A-Z]{2,20}-[A-Z]{3}-\d{2,4}-\d+\b)/gi;
 const parts:ReactNode[]=[];let cursor=0,match:RegExpExecArray|null;
 while((match=token.exec(text))){
  if(match.index>cursor)parts.push(<Fragment key={`text-${cursor}`}>{text.slice(cursor,match.index)}</Fragment>);
  if(match[2]&&match[3])parts.push(<span className="chat-mention" key={`mention-${match.index}`} title="Tagged member">@{match[2]}</span>);
  else if(match[4]){const caseId=match[4];parts.push(<button type="button" className="chat-case-link" disabled={disabled} key={`case-${match.index}`} aria-label={`Open case ${caseId}`} onClick={()=>onOpen(caseId)}>{caseId}</button>);}
  cursor=token.lastIndex;
 }
 if(cursor<text.length)parts.push(<Fragment key={`text-${cursor}`}>{text.slice(cursor)}</Fragment>);
 return <>{parts}</>;
}
