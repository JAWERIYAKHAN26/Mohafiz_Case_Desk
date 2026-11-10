import {useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {databaseMessage} from './liveOperations';
import {WORKBOOK_SHA,type WorkbookProfile} from './workbookData';
import {workbookIssueRules} from './workbookRules';

export default function LiveCaseIntake({profile,companies,cities,onCreated,onCancel}:{profile:WorkbookProfile;companies:string[];cities:string[];onCreated:(id:string)=>void;onCancel:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef(crypto.randomUUID());
  const [issue,setIssue]=useState('');
  const [city,setCity]=useState(''),[hubs,setHubs]=useState<string[]>([]),[hub,setHub]=useState(''),[customHub,setCustomHub]=useState(false),[hubLoading,setHubLoading]=useState(false),[hubError,setHubError]=useState('');
  useEffect(()=>{let alive=true;setHub('');setCustomHub(false);setHubs([]);setHubError('');if(!city||!supabase)return;setHubLoading(true);void supabase.rpc('portal_city_hubs',{p_city:city}).then(result=>{if(!alive)return;setHubLoading(false);if(result.error)setHubError(databaseMessage(result.error));else{const values=(result.data||[]) as string[];setHubs(values);if(values.length===1)setHub(values[0]);}});return()=>{alive=false;};},[city]);
  const rule=workbookIssueRules.find(rule=>rule.issue===issue);
  if(profile.role!=='Client')return null;
  return <form className="box intake live-intake" onSubmit={async event=>{
    event.preventDefault();if(!supabase||busy||profile.role!=='Client')return;
    const data=new FormData(event.currentTarget);
    setBusy(true);setError('');
    const payload=Object.fromEntries(data.entries());
    payload.company=profile.company;
    try {
      const result=await supabase.rpc('portal_create_case',{p_sha:WORKBOOK_SHA,p_request:request.current,p_data:payload});
      if(result.error)throw result.error;
      onCreated(result.data as string);
    } catch(problem){setError(databaseMessage(problem));}finally{setBusy(false);}
  }}>
    <h2>Raise a Case</h2>
    <p className="sub">The Case ID is generated automatically when the case is saved.</p>
    <label>Client Company<input value={profile.company} readOnly/></label>
    <div className="grid"><label>Issue Type<select name="issue" required value={issue} onChange={event=>setIssue(event.target.value)}><option value="">Select issue type</option>{workbookIssueRules.map(rule=><option key={rule.issue}>{rule.issue}</option>)}</select></label><label>Priority<input value={rule?.priority||''} readOnly aria-label="Calculated priority"/><input type="hidden" name="priority" value={rule?.priority||''}/></label></div>
    <div className="grid"><label>City<select name="city" required value={city} onChange={e=>setCity(e.target.value)}><option value="">Select city</option>{cities.map(value=><option key={value}>{value}</option>)}</select></label><label>Client Hub{hubs.length>0&&<select aria-label="City hub" name={customHub?undefined:'hub'} required={!customHub} disabled={!city||hubLoading} value={customHub?'__other__':hub} onChange={e=>{if(e.target.value==='__other__'){setCustomHub(true);setHub('');}else{setCustomHub(false);setHub(e.target.value);}}}><option value="">Select relevant hub</option>{hubs.map(value=><option key={value}>{value}</option>)}<option value="__other__">Other hub...</option></select>}{(!hubs.length||customHub)&&<input name="hub" required maxLength={200} value={hub} disabled={!city||hubLoading} placeholder={hubLoading?'Loading hubs...':'Enter hub name'} onChange={e=>setHub(e.target.value)}/>}{hubError&&<small role="alert">{hubError}</small>}</label></div>
    <label>Exact Incident Location<input name="location" required maxLength={2000}/></label>
    <div className="grid"><label>Rider Name<input name="rider_name" required maxLength={200}/></label><label>Rider Phone<input name="rider_phone" type="tel" required maxLength={50}/></label></div>
    <div className="grid"><label>Incident Date<input name="incident_date" type="date" required defaultValue={new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}/></label><label>Company Loss (PKR)<input name="amount" type="number" min="0" step="0.01" required/></label></div>
    <div className="grid"><label>Personal Loss (PKR)<input name="personal_loss" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Rider CNIC<input name="rider_cnic" maxLength={50}/></label></div>
    <details><summary>Additional case information</summary><div className="grid"><label>Customer Name<input name="customer_name" maxLength={200}/></label><label>Customer Phone<input name="customer_phone" type="tel" maxLength={50}/></label><label>Customer CNIC<input name="customer_cnic" maxLength={50}/></label><label>Consignment Number<input name="consignment" maxLength={200}/></label><label>Coordinates<input name="coordinates" maxLength={200} placeholder="Latitude, longitude"/></label></div></details>
    <label>Description<textarea name="description" required minLength={10} maxLength={10000}/></label>
    {error&&<div className="workbook-error" role="alert">{error}</div>}
    <div className="live-case-action-buttons"><button className="primary" disabled={busy}>{busy?'Saving...':'Submit Case'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
