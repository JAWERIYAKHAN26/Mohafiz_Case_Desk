import {useEffect,useRef} from 'react';
import {MapPin,Phone,X} from 'lucide-react';
import {sourceText,type WorkbookCase} from './workbookData';
import {workflowStage} from './liveOperations';

export default function LiveLocationModal({item,onClose}:{item:WorkbookCase;onClose:()=>void}) {
  const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    close.current?.focus();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <div className="modal-overlay" onClick={onClose} onKeyDown={event=>{
    if(event.key==='Escape')onClose();
    if(event.key==='Tab'){
      const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  }}>
    <section className="modal-card live-location-modal" role="dialog" aria-modal="true" aria-labelledby="live-location-title" onClick={event=>event.stopPropagation()}>
      <div className="modal-header"><div className="live-location-title"><MapPin size={20}/><h3 id="live-location-title">Exact Incident Location</h3></div><button ref={close} className="modal-close" aria-label="Close location" onClick={onClose}><X size={18}/></button></div>
      <div className="live-location-reference"><b>Case Reference: {sourceText(item.case_id)}</b><span className={'chip '+String(item.priority||'').toLowerCase()}>{sourceText(item.priority)}</span></div>
      <span className="hub-tag">Raised by: {sourceText(item.hub||item.company)}</span>
      <div className="live-location-address"><small>CLIENT REPORTED EXACT LOCATION:</small><p><MapPin size={16}/>{sourceText(item.location)}</p><small>City: <b>{sourceText(item.city)}</b> · Reported: <b>{sourceText(item.reported_date)}</b></small></div>
      <div className="live-location-people"><div><small>RIDER ON DUTY</small><b>{sourceText(item.rider_name)}</b><span><Phone size={11}/> {sourceText(item.rider_phone)}</span></div><div><small>ASSIGNED OFFICER</small><b>{item.assigned_fso||'Unassigned / Pending SFSO'}</b><span>Status: {workflowStage(item)||(item.status==='Pending'?'New':sourceText(item.status))}</span></div></div>
      <div className="live-location-grid"><MapPin size={34}/><b>{sourceText(item.city)} Incident Location</b><small>{item.coordinates?String(item.coordinates):'GPS coordinates not recorded'}</small></div>
      <div className="live-location-footer"><button className="primary" onClick={onClose}>Done / Close</button></div>
    </section>
  </div>;
}
