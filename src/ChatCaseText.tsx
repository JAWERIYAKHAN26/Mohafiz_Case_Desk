import {Fragment} from 'react';
// Match server-generated Case IDs without treating call UUIDs or ordinary text as cases.
export default function ChatCaseText({text,onOpen,disabled=false}:{text:string;onOpen:(id:string)=>void;disabled?:boolean}){
 const parts=text.split(/(\b[A-Z]{2,12}-[A-Z]{2,20}-[A-Z]{3}-\d{2,4}-\d+\b)/gi);
 return <>{parts.map((part,index)=>index%2===1?<button type="button" className="chat-case-link" disabled={disabled} key={index} aria-label={`Open case ${part}`} onClick={()=>onOpen(part)}>{part}</button>:<Fragment key={index}>{part}</Fragment>)}</>;
}
