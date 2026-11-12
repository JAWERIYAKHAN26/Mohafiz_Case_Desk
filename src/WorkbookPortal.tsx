import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, BriefcaseBusiness, FileText, Settings, Bell, ChartNoAxesCombined, RefreshCw, LogOut, UserRound, ChevronLeft, ChevronRight, MapPin, Menu, X, Search, Columns3, MessagesSquare, MessageSquareLock } from 'lucide-react';
import { supabase } from './supabase';
import { WORKBOOK_SHA, WORKBOOK_PAGE_SIZE, workbookSelect, workbookListSelect, workbookKey, sourceText, workbookPageCsv, caseAgeLabel, type WorkbookCase, type WorkbookProfile, type WorkbookSummary } from './workbookData';
import { workbookIssueRules } from './workbookRules';
import './workbook-portal.css';
import LiveFsoWorkspace from './LiveFsoWorkspace';
import LiveFieldReport from './LiveFieldReport';
import './fso-app.css';
import { workspaceGroups } from './workspaceGroups';
import GroupCallProvider from './GroupCallProvider';
import DirectVoiceCalls from './DirectVoiceCalls';
import LiveGroupChat from './LiveGroupChat';
import CaseDetail from './LiveCaseDetail';
import LiveCaseReport from './LiveCaseReport';
import LiveLocationModal from './LiveLocationModal';
import LiveCaseIntake from './LiveCaseIntake';
import LiveAuditLogs from './LiveAuditLogs';
import {databaseMessage,workflowStage,type WorkflowCounters} from './liveOperations';

type Filters = { search: string; company: string; city: string; status: string; priority: string; issue: string; from: string; to: string };
const emptyFilters: Filters = { search:'',company:'',city:'',status:'',priority:'',issue:'',from:'',to:'' };
type Activity = { id:string; action:string; actor_name:string; source_sheet:string; source_row:number; created_at:string };

type Options = { companies: string[]; cities: string[]; statuses: string[]; priorities: string[]; issues: string[] };

const defaultIssues = Array.from(new Set(workbookIssueRules.map(item => item.issue))).sort();

export const BOARD_STAGES = ['To acknowledge', 'In progress', 'Closed'] as const;
export type BoardStage = typeof BOARD_STAGES[number];

export function getCaseBoardStage(item: WorkbookCase): BoardStage {
  const stage = workflowStage(item);
  const status = item.status;
  if (stage === 'Closed' || status === 'Closed') {
    return 'Closed';
  }
  if (stage === 'New' || (!stage && status === 'Pending')) {
    return 'To acknowledge';
  }
  if (['In progress', 'Arrived', 'Submitted', 'Reviewed', 'Escalated', 'Acknowledged', 'Hold'].includes(stage || '') || status === 'In progress' || status === 'Arrived') {
    return 'In progress';
  }
  return 'To acknowledge';
}

function CompanyMark({company}:{company:string}) {
  if(company==='Buscaro')return <span className="workbook-company-logo buscaro" aria-hidden="true"><img src="/images/buscaro-logo.svg" alt=""/></span>;
  if(company==='Daraz')return <span className="workbook-company-logo daraz" aria-hidden="true"><img src="/images/daraz-logo.svg" alt=""/></span>;
  if(company==='PostEx')return <span className="workbook-company-logo postex" aria-hidden="true"><b>P</b><i/></span>;
  return <span className="workbook-company-logo other" aria-hidden="true">{company.slice(0,1).toUpperCase()}</span>;
}

export default function WorkbookPortal({ profile, light, onTheme, onLogout }: { profile: WorkbookProfile; light: boolean; onTheme: (value: boolean)=>void; onLogout: ()=>Promise<void> }) {
  const [page,setPage]=useState<string>(profile.role==='CRO'||profile.role==='CRO Manager'?'dashboard':profile.role==='Client'?'reports':'cases');
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const [fromDashboard,setFromDashboard]=useState(false);
  const [pageNumber,setPageNumber]=useState(0);
  const [rows,setRows]=useState<WorkbookCase[]>([]);
  const [total,setTotal]=useState(0);
  const [summary,setSummary]=useState<WorkbookSummary|null>(null);
  const [options,setOptions]=useState<Options>({companies:[],cities:[],statuses:[],priorities:[],issues:defaultIssues});
  const [selected,setSelected]=useState<WorkbookCase|null>(null);
  const [conversationCase,setConversationCase]=useState<WorkbookCase|null>(null);
  const [directCallsOpen,setDirectCallsOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [summaryLoading,setSummaryLoading]=useState(true);
  const [error,setError]=useState('');
  const [setupError,setSetupError]=useState('');
  const [revision,setRevision]=useState(0);
  const [menuOpen,setMenuOpen]=useState(false);
  const [logoutError,setLogoutError]=useState('');
  const [accountSettingsOpen,setAccountSettingsOpen]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [reportItem,setReportItem]=useState<WorkbookCase|null>(null);
  const [fieldReportItem,setFieldReportItem]=useState<WorkbookCase|null>(null);
  const [counters,setCounters]=useState<WorkflowCounters|null>(null);
  const [counterError,setCounterError]=useState('');
  const [counterRevision,setCounterRevision]=useState(0);
  const [activity,setActivity]=useState<Activity[]>([]);
  const [activityError,setActivityError]=useState('');
  const [locationItem,setLocationItem]=useState<WorkbookCase|null>(null);
  const [acknowledging,setAcknowledging]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [unread,setUnread]=useState<Record<string,number>>({});
  const [soundReady,setSoundReady]=useState(false);
  const ringtoneContext=useRef<AudioContext|null>(null);
  const [visits,setVisits]=useState<Activity[]>([]);
  useEffect(()=>{
    const unlock=()=>{
      try{
        const context=ringtoneContext.current||(ringtoneContext.current=new AudioContext());
        void context.resume().then(()=>setSoundReady(true)).catch(()=>setSoundReady(false));
      }catch{setSoundReady(false);}
    };
    document.addEventListener('pointerdown',unlock);
    document.addEventListener('keydown',unlock);
    return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);void ringtoneContext.current?.close();ringtoneContext.current=null;};
  },[]);
  useEffect(()=>{
    const unreadOutsideOpenChat=Object.entries(unread).some(([key,count])=>count>0&&key!==page);
    if(!soundReady||!unreadOutsideOpenChat)return;
    const context=ringtoneContext.current;
    if(!context)return;
    const ring=()=>{
      if(context.state!=='running')return;
      const start=context.currentTime;
      for(const [offset,frequency] of [[0,880],[0.2,660],[0.65,880],[0.85,660]] as const){
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.type='square';oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(0.0001,start+offset);gain.gain.exponentialRampToValueAtTime(0.3,start+offset+0.02);gain.gain.exponentialRampToValueAtTime(0.0001,start+offset+0.18);
        oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+offset);oscillator.stop(start+offset+0.19);
      }
    };
    ring();
    const timer=window.setInterval(ring,2200);
    return()=>window.clearInterval(timer);
  },[unread,page,soundReady]);
  useEffect(()=>{
    let alive=true;
    void supabase?.rpc('workspace_unread_groups').then(result=>{if(alive&&!result.error)setUnread(result.data||{});});
    return()=>{alive=false;};
  },[counterRevision,revision,counters]);
  useEffect(()=>{
    if(!supabase)return;
    const label=page==='dashboard'?'Dashboard':page==='new'?'New Cases':page==='cases'?'Case Board':page==='reports'?'Reports':page==='intake'?'Raise a Case':workspaceGroups(profile).find(item=>item.key===page)?.label||page;
    const entry:Activity={id:crypto.randomUUID(),action:'Opened '+label,actor_name:profile.name,source_sheet:'',source_row:0,created_at:new Date().toISOString()};
    void supabase.rpc('portal_record_visit',{p_page:page}).then(result=>{
      if(result.error)setVisits(current=>[entry,...current].slice(0,6));
      else setCounterRevision(value=>value+1);
    });
  },[page,profile.email]);
  async function acknowledge(item:WorkbookCase){
    if(!supabase||acknowledging)return;
    setAcknowledging(workbookKey(item));setError('');
    try {
      const result=await supabase.rpc('case_workflow_action',{p_sha:item.source_sha256,p_sheet:item.source_sheet,p_row:item.source_row,p_action:'acknowledge',p_body:''});
      if(result.error)throw result.error;
      setNotice(`Case ${sourceText(item.case_id)} acknowledged and forwarded to the field team.`);
      setRevision(value=>value+1);
    }catch(problem){setError(databaseMessage(problem));}finally{setAcknowledging(null);}
  }
  function openUpdates(){
    const cityGroups=workspaceGroups(profile).filter(item=>item.kind==='city');
    const target=cityGroups.find(item=>(unread[item.key]||0)>0)||cityGroups[0]||workspaceGroups(profile)[0];
    if(target)navigate(target.key,true);
  }

  useEffect(()=>{
    if(page!=='dashboard'||!supabase)return;
    let alive=true;
    const load=async()=>{
      const unified=await supabase!.rpc('portal_recent_activity',{p_sha:WORKBOOK_SHA});
      const result=unified.error?await supabase!.from('case_workflow_events').select('id,action,actor_name,source_sheet,source_row,created_at').eq('source_sha256',WORKBOOK_SHA).order('created_at',{ascending:false}).limit(6):unified;
      if(!alive)return;
      if(result.error)setActivityError(databaseMessage(result.error));
      else {setActivity(result.data||[]);setActivityError('');}
    };
    void load();
    const channel=supabase.channel('dashboard-activity-'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'case_workflow_events',filter:`source_sha256=eq.${WORKBOOK_SHA}`},()=>void load()).subscribe();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);
    return()=>{alive=false;window.clearInterval(timer);void supabase!.removeChannel(channel);};
  },[page,profile.email,revision,counterRevision]);
  useEffect(()=>{
    let alive=true;let timer:number|undefined;
    const load=async()=>{if(!supabase)return;
      // Clients only need the unread badge; the full case counters scan every workbook row and time out under client RLS.
      if(profile.role==='Client'){const unread=await supabase.rpc('workspace_unread_count');if(!alive)return;if(unread.error){setCounterError(databaseMessage(unread.error));setCounters(null);}else{const n=Number(unread.data)||0;setCounters({to_acknowledge:0,in_progress:0,reports_to_review:0,unread_messages:n,updates_to_review:n});setCounterError('');}return;}
      const result=await supabase.rpc('workflow_counters',{p_sha:WORKBOOK_SHA});if(!alive)return;if(result.error){setCounterError(databaseMessage(result.error));setCounters(null);}else{setCounters(result.data as WorkflowCounters);setCounterError('');}};
    const queue=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>void load(),250);};
    void load();
    const channel=supabase?.channel('live-workspace-counters-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'case_workflow'},queue).on('postgres_changes',{event:'INSERT',schema:'public',table:'workspace_messages'},queue).subscribe(status=>{if(status==='SUBSCRIBED')queue();});
    const poll=window.setInterval(()=>{if(document.visibilityState==='visible')queue();},30000);
    return()=>{alive=false;window.clearTimeout(timer);window.clearInterval(poll);if(channel)void supabase!.removeChannel(channel);};
  },[profile.email,profile.role,counterRevision,revision]);
  useEffect(()=>{
    if(!supabase)return;
    let timer:number|undefined;
    const channel=supabase.channel('case-arrivals-'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'workbook_import_cases',filter:`source_sha256=eq.${WORKBOOK_SHA}`},()=>{
      window.clearTimeout(timer);timer=window.setTimeout(()=>setRevision(value=>value+1),250);
    }).subscribe();
    return()=>{window.clearTimeout(timer);void supabase!.removeChannel(channel);};
  },[profile.email]);
  function navigate(next:typeof page, dashboardOrigin=false) { if(next==='audit'&&profile.role!=='CRO Manager')return; if(next==='intake'&&profile.role!=='Client')return; setPage(next); setSelected(null); setConversationCase(null); setFieldReportItem(null); setMenuOpen(false); setFromDashboard(dashboardOrigin); }
  function filter(key:keyof Filters,value:string) { setFilters(current=>({...current,[key]:value})); setPageNumber(0); }
  useEffect(()=>{
    let alive=true; setSummaryLoading(true); setSetupError('');
    void(async()=>{
      if(!supabase){if(alive){setSetupError('Database connection is unavailable.');setSummaryLoading(false);}return;}
      const results=await Promise.allSettled([supabase.rpc('workbook_summary',{p_source_sha:WORKBOOK_SHA}),supabase.rpc('workbook_filter_options',{p_source_sha:WORKBOOK_SHA})]);
      if(!alive)return;
      const summaryResult=results[0], optionsResult=results[1];
      const failures:string[]=[];
      const describeFailure=(result:typeof summaryResult)=>{
        const problem=result.status==='rejected'?result.reason:result.value.error;
        if(problem&&typeof problem==='object') {
          const message=typeof problem.message==='string'?problem.message:'Database request failed';
          const code=typeof problem.code==='string'?` (${problem.code})`:'';
          return message+code;
        }
        return 'Database request failed';
      };
      if(summaryResult.status==='fulfilled'&&!summaryResult.value.error)setSummary(summaryResult.value.data as WorkbookSummary);
      else{setSummary(null);failures.push('Dashboard totals: '+describeFailure(summaryResult));}
      if(optionsResult.status==='fulfilled'&&!optionsResult.value.error){
        const data=optionsResult.value.data as Partial<Options>;
        setOptions({
          companies:[...(data.companies||[])].sort(),
          cities:[...(data.cities||[])].sort(),
          statuses:[...(data.statuses||[])].sort(),
          priorities:[...(data.priorities||[])].sort(),
          issues:[...new Set([...(data.issues||[]),...defaultIssues])].sort()
        });
      } else failures.push('Filter options: '+describeFailure(optionsResult));
      setSetupError(failures.join(' | '));
      setSummaryLoading(false);
    })().catch(()=>{if(alive){setSetupError('Could not connect to the database. Please retry.');setSummaryLoading(false);}});
    return()=>{alive=false;};
  },[revision,profile.email,profile.role]);
  useEffect(()=>{
      if(page==='audit'||page==='dashboard'||page.startsWith('group:')||page==='updates'||page==='intake'){setLoading(false);return;}
    let alive=true;const controller=new AbortController();setLoading(true);setError('');setRows([]);
    const timer=window.setTimeout(()=>{
      void(async()=>{
        try{
          if(!supabase)throw new Error('Database connection is unavailable.');
          const effective=await supabase.rpc('desk_case_list',{p_sha:WORKBOOK_SHA,p_filters:{...filters,status:page==='new'?'__to_ack__':filters.status},p_page:pageNumber,p_size:WORKBOOK_PAGE_SIZE}).abortSignal(controller.signal);
          if(!effective.error){
            const data=effective.data as {rows:WorkbookCase[];total:number};
            if(!filters.issue||data.rows.length===0||data.rows.every(r=>sourceText(r.issue)===filters.issue)){
              if(alive){setRows(data.rows);setTotal(data.total);}
              return;
            }
          }
          if(effective.error&&!['PGRST202','42883'].includes(effective.error.code))throw effective.error;
          const projection=page==='new'?workbookListSelect+',case_workflow()':filters.status==='__active__'||filters.status==='__review__'?workbookListSelect+',case_workflow!inner(stage)':filters.status==='__to_ack__'?workbookListSelect+',case_workflow()':workbookListSelect+',case_workflow(stage)';
          let query=supabase.from('workbook_import_cases').select(projection,{count:'exact'}).eq('source_sha256',WORKBOOK_SHA);
          // Explicit coverage predicates help PostgreSQL narrow the query; RLS remains authoritative.
          if(profile.role==='FSO')query=query.eq('assigned_fso',profile.officerName).eq('city',profile.city);
          if(profile.role==='Client')query=query.eq('company',profile.company);
          if(profile.role==='SFSO'||profile.role==='SOM')query=query.in('city',profile.city==='Islamabad'?['Islamabad','Rawalpindi']:[profile.city]);
          if(filters.company)query=query.eq('company',filters.company);
          if(filters.city)query=query.eq('city',filters.city);
          if(filters.priority)query=query.eq('priority',filters.priority);
          if(filters.issue)query=query.eq('issue',filters.issue);
          if(page==='new')query=query.is('case_workflow',null).eq('status','Pending');
          else if(filters.status==='__active__')query=query.in('case_workflow.stage',['In progress','Arrived','Submitted','Reviewed']);
          else if(filters.status==='__review__')query=query.eq('case_workflow.stage','Submitted');
          else if(filters.status==='__to_ack__')query=query.is('case_workflow',null).eq('status','Pending');
          else if(filters.status)query=filters.status==='__open__'?query.or('status.neq.Closed,status.is.null'):filters.status==='__blank__'?query.or('status.is.null,status.eq.'):query.eq('status',filters.status);
          if(filters.search.trim())query=query.ilike('case_id','%'+filters.search.trim().replace(/[\\%_]/g,'\\$&')+'%');
          if(filters.from)query=query.gte('reported_date_iso',filters.from);
          if(filters.to)query=query.lte('reported_date_iso',filters.to);
          let result:{data:unknown[]|null;error:{message:string;code:string}|null;count:number|null}=await query.order('reported_date_iso',{ascending:false,nullsFirst:false}).order('source_sheet').order('source_row',{ascending:false})
            .range(pageNumber*WORKBOOK_PAGE_SIZE,(pageNumber+1)*WORKBOOK_PAGE_SIZE-1).abortSignal(controller.signal);
          if(result.error&&['PGRST200','PGRST205'].includes(result.error.code)&&page!=='new'&&!['__active__','__review__','__to_ack__'].includes(filters.status)){
            result=await query.select(workbookListSelect).order('reported_date_iso',{ascending:false,nullsFirst:false}).order('source_sheet').order('source_row',{ascending:false}).range(pageNumber*WORKBOOK_PAGE_SIZE,(pageNumber+1)*WORKBOOK_PAGE_SIZE-1).abortSignal(controller.signal);
          }
          if(result.error)throw result.error;
          if(alive){setRows((result.data||[]) as unknown as WorkbookCase[]);setTotal(result.count||0);}
        }catch(problem){if(alive){setTotal(0);setError(problem&&typeof problem==='object'&&'message' in problem?String(problem.message)+('code' in problem?` (${String(problem.code)})`:''):'The database request failed. Please retry.');}}
        finally{if(alive)setLoading(false);}
      })();
    },250);
    return()=>{alive=false;window.clearTimeout(timer);controller.abort();};
  },[filters,pageNumber,revision,profile.email,profile.role,profile.city,profile.company,profile.officerName,page]);
  const allNav=[['dashboard','Dashboard',LayoutDashboard],['cases',['FSO','Client'].includes(profile.role)?'My Cases':'Case Board',['FSO','Client'].includes(profile.role)?BriefcaseBusiness:Columns3],['reports',profile.role==='Client'?'My Cases':'Reports',ChartNoAxesCombined]] as const;
  const primaryNav=allNav.filter(([key])=>key!=='reports'&&(profile.role==='FSO'?key==='cases':profile.role==='Client'?false:['SFSO','SOM'].includes(profile.role)?key!=='dashboard':true));
  const reportsNav=allNav.filter(([key])=>key==='reports');
  const groups=workspaceGroups(profile);
  const group=groups.find(item=>item.key===page);
  const internalUnreadCount=groups.filter(item=>item.kind==='city').reduce((sum,item)=>sum+(unread[item.key]||0),0);
  const nav=[...primaryNav,...(profile.role==='CRO Manager'?[['audit','Audit Logs',FileText] as const]:[]),...groups.map(item=>[item.key,item.label,item.kind==='city'?MessageSquareLock:MessagesSquare] as const),...reportsNav];
  const mobileNav=profile.role==='FSO'?nav.slice(0,2):nav.slice(0,3);
  const showBoard=page==='cases'&&!['FSO','Client'].includes(profile.role);
  const title=page==='intake'?'Raise a Case':selected?`Case ${sourceText(selected.case_id)}`:(page==='updates'?'Updates to review':page==='new'?'New Cases':nav.find(item=>item[0]===page)?.[1])||'Cases';
  const statusClass=(status:unknown)=>status==='Closed'?'resolved':status==='Pending'?'waiting':'neutral';
  async function exportPage(){
    if(!supabase||exporting)return;
    setExporting(true);
    try{
      const snapshot=[...rows];
      const sheets=[...new Set(snapshot.map(row=>row.source_sheet))];
      const results=await Promise.all(sheets.map(sheet=>supabase!.from('workbook_effective_cases').select(workbookSelect)
        .eq('source_sha256',WORKBOOK_SHA).eq('source_sheet',sheet).in('source_row',snapshot.filter(row=>row.source_sheet===sheet).map(row=>row.source_row))));
      const records=new Map<string,WorkbookCase>();
      for(const result of results){if(result.error)throw result.error;for(const row of (result.data||[]) as unknown as WorkbookCase[])records.set(workbookKey(row),row);}
      const fullRows=snapshot.map(row=>{const full=records.get(workbookKey(row));if(!full)throw new Error('Some export records could not be loaded. Retry the export.');return full;});
      const blob=new Blob(['\ufeff'+workbookPageCsv(fullRows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`mohafiz-cases-page-${pageNumber+1}.csv`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError('Export could not load all source fields. No incomplete file was exported. Please retry.');}
    finally{setExporting(false);}
  }

  const caseFilters=(<div className="box workbook-filters"><label className="workbook-search"><span className="sr-only">Search Case ID</span><Search size={15}/><input type="search" placeholder="Search Case ID…" value={filters.search} onChange={event=>filter('search',event.target.value)}/></label>
          {profile.role!=='Client'&&<select aria-label="Company" value={filters.company} onChange={event=>filter('company',event.target.value)}><option value="">Company</option>{options.companies.map(value=><option key={value} value={value}>{value}</option>)}</select>}
          {!['FSO','SFSO','SOM'].includes(profile.role)&&<select aria-label="City" value={filters.city} onChange={event=>filter('city',event.target.value)}><option value="">City</option>{options.cities.map(value=><option key={value} value={value}>{value}</option>)}</select>}
          <select aria-label="Issue" value={filters.issue} onChange={event=>filter('issue',event.target.value)}><option value="">Issue</option>{options.issues.map(value=><option key={value} value={value}>{value}</option>)}</select>
          {page==='new'?<select aria-label="Priority" value={filters.priority} onChange={event=>filter('priority',event.target.value)}><option value="">Priority</option>{options.priorities.map(value=><option key={value}>{value}</option>)}</select>:<select aria-label="Status" value={filters.status} onChange={event=>filter('status',event.target.value)}><option value="">Status</option>{options.statuses.map(value=><option key={value}>{value}</option>)}<option value="__blank__">Not recorded</option><option value="__to_ack__">To acknowledge</option><option value="__active__">In progress</option><option value="__review__">Findings to review</option></select>}
          {page==='reports'&&<><label>From<input type="date" value={filters.from} onChange={event=>filter('from',event.target.value)}/></label><label>To<input type="date" min={filters.from} value={filters.to} onChange={event=>filter('to',event.target.value)}/></label></>}
        </div>);

  const accountMenu=(<details className="account-menu" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
        <summary className="header-avatar" aria-label="Open account options" title="Account"><UserRound size={18}/></summary>
        <button className="account-menu-backdrop" type="button" tabIndex={-1} aria-label="Close account options" onClick={event=>event.currentTarget.closest('details')?.removeAttribute('open')}/>
        <div className="account-menu-panel"><div className="account-profile"><span className="account-profile-avatar"><UserRound size={36} strokeWidth={1.5}/></span><b className="account-profile-welcome">Welcome {profile.name}</b>{profile.name!==profile.role&&<span className="account-profile-role">{profile.role}</span>}<small className="account-profile-email">{profile.email}</small></div>
          <div className="account-menu-actions"><button type="button" aria-expanded={accountSettingsOpen} aria-controls="live-account-settings" onClick={()=>setAccountSettingsOpen(value=>!value)}><Settings size={18}/>Account Settings</button>
            {accountSettingsOpen&&<div className="account-settings-fields" id="live-account-settings"><label>Email<input value={profile.email} readOnly/></label><label>Appearance<select value={light?'light':'dark'} onChange={event=>onTheme(event.target.value==='light')}><option value="light">Light</option><option value="dark">Dark</option></select></label></div>}
            <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');openUpdates();}}><Bell size={18}/>Notifications{(profile.role==='Client'?(counters?.unread_messages||0):internalUnreadCount)>0&&<span className="account-notification-count">{profile.role==='Client'?counters?.unread_messages:internalUnreadCount}</span>}</button>
            <button type="button" className="account-logout" onClick={()=>{setLogoutError('');void onLogout().catch(()=>setLogoutError('Could not sign out. Please retry.'));}}><LogOut size={16}/>Log out</button>{logoutError&&<p className="workbook-error" role="alert">{logoutError}</p>}
          </div>
        </div>
      </details>);
  const pagination=(<div className={"workbook-pagination "+(profile.role==='FSO'?'live-field-pagination':'')}><small>{total?`${pageNumber*WORKBOOK_PAGE_SIZE+1}–${Math.min((pageNumber+1)*WORKBOOK_PAGE_SIZE,total)} of ${total.toLocaleString()}`:'0 cases'}</small><button disabled={loading||pageNumber===0} onClick={()=>setPageNumber(value=>value-1)}><ChevronLeft size={15}/>Previous</button><button disabled={loading||(pageNumber+1)*WORKBOOK_PAGE_SIZE>=total} onClick={()=>setPageNumber(value=>value+1)}>Next<ChevronRight size={15}/></button></div>);

  if(profile.role==='FSO'){
    // Field officers get the phone-first field app: My Cases, field report and City Chat with a floating tab bar.
    const cityGroup=groups.find(item=>item.kind==='city');
    const openCaseChat=(item:WorkbookCase)=>{
      const target=groups.find(entry=>entry.kind==='city'&&entry.value===(item.city==='Rawalpindi'?'Islamabad':item.city))||cityGroup;
      if(target){navigate(target.key);setConversationCase(item);}else setNotice('No conversation group is configured for this case.');
    };
    const refreshAfterChange=(message:string)=>{setNotice(message);setRevision(value=>value+1);setCounterRevision(value=>value+1);};
    const tabs=[['cases','My Cases',BriefcaseBusiness,0],...(cityGroup?[[cityGroup.key,'City Chat',MessagesSquare,unread[cityGroup.key]||0]]:[])] as [string,string,typeof BriefcaseBusiness,number][];
    return <GroupCallProvider profile={profile} light={light}>
      <DirectVoiceCalls profile={profile} open={directCallsOpen} groupKey={group?.key} onClose={()=>setDirectCallsOpen(false)}/>
      <div className={'fso-app'+(group&&!selected?' fso-app-chat':'')+(selected||fieldReportItem?' fso-app-subpage':'')}>
        {notice&&<div className="fso-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></button></div>}
        {setupError&&<div className="fso-error" role="alert">{setupError}</div>}
        {counterError&&<div className="fso-error" role="alert">Workflow/chat setup: {counterError}</div>}
        {selected?<div className="fso-screen fso-detail"><CaseDetail key={workbookKey(selected)} item={selected} profile={profile} onChange={()=>{setCounterRevision(value=>value+1);setRevision(value=>value+1);}} onBack={()=>setSelected(null)} onConversation={openCaseChat}/></div>
          :fieldReportItem?<LiveFieldReport key={workbookKey(fieldReportItem)} item={fieldReportItem} onBack={()=>setFieldReportItem(null)} onChat={openCaseChat} onSent={message=>{setFieldReportItem(null);refreshAfterChange(message);}}/>
          :group?<LiveGroupChat key={group.key} variant="mobile" onOpenCase={setSelected} onStartDirectCall={()=>setDirectCallsOpen(true)} profile={profile} group={group} caseContext={conversationCase} onRead={()=>setCounterRevision(value=>value+1)}/>
          :<>
            {error&&<div role="alert" className="fso-error">{error}<button onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
            <LiveFsoWorkspace profile={profile} rows={rows} summary={summary} activeCount={counters?.in_progress} loading={loading} total={total} status={filters.status} search={filters.search} accountMenu={accountMenu}
              onStatus={value=>filter('status',value)} onSearch={value=>filter('search',value)} onOpen={setSelected} onReload={()=>setRevision(value=>value+1)}
              onChat={openCaseChat} onReport={setFieldReportItem} onChanged={refreshAfterChange}/>
            {total>WORKBOOK_PAGE_SIZE&&pagination}
          </>}
      </div>
      {!selected&&!fieldReportItem&&<nav className="fso-tabbar" aria-label="Field app navigation">{tabs.map(([key,label,Icon,count])=><button key={key} className={page===key?'active':''} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}><span className="fso-tab-icon"><Icon size={20}/>{count>0&&<span className="fso-tab-badge">{count}</span>}</span>{label}</button>)}</nav>}
    </GroupCallProvider>;
  }

  return <GroupCallProvider profile={profile} light={light}>
    <DirectVoiceCalls profile={profile} open={directCallsOpen} groupKey={group?.key} onClose={()=>setDirectCallsOpen(false)}/>
    {locationItem&&<LiveLocationModal item={locationItem} onClose={()=>setLocationItem(null)}/>}
    {reportItem&&<LiveCaseReport item={reportItem} profile={profile} onClose={()=>setReportItem(null)}/>}
    {menuOpen&&<button className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}
    <aside className={menuOpen?'mobile-open':''}><div className="workspace">Mohafiz<button className="workbook-menu-close" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div><nav>{nav.map(([key,label,Icon])=><button key={key} className={page===key||(key==='dashboard'&&page==='new')?'active':''} onClick={()=>navigate(key)}><span className="nav-icon"><Icon size={17}/></span><span className="nav-label">{label}</span>{(unread[key]||0)>0&&<span className="nav-unread-badge">{unread[key]}</span>}</button>)}</nav><div className="workbook-sidebar-account"><b>{profile.name}</b><small>{profile.role}{profile.city?` · ${profile.city}`:''}</small></div></aside>
    <main className="workbook-main">
    <section className={"content workbook-content "+(selected?'case-detail-content ':'')+(page==='new'?'workbook-new-content ':'')+(profile.role==='FSO'&&!selected&&!group?'live-field-content':'')}><div className="heading workbook-page-heading">
      <button className="mobile-menu-btn" aria-label="Open navigation" onClick={()=>setMenuOpen(true)}><Menu size={18}/></button>
      <div className="workbook-page-title"><div className="eyebrow" hidden={page==='new'}>{selected?'CASE DETAILS':group?(group.kind==='city'?'CITY OPERATIONS CHAT':'COMMUNICATION'):page==='reports'?'ANALYTICS':page==='dashboard'?'OVERVIEW':showBoard?'CASE MANAGEMENT':'FIELD WORKSPACE'}</div><h1>{title}</h1></div>
      <div className="workbook-heading-actions">{profile.role==='Client'&&page!=='dashboard'&&page!=='new'&&page!=='intake'&&!selected&&!group&&<button className="primary" onClick={()=>navigate('intake')}>+ Raise a Case</button>}{fromDashboard&&page!=='dashboard'&&!selected&&<button className="workbook-reload" onClick={()=>navigate('dashboard')}>Back to Dashboard</button>}{page==='reports'&&!selected&&<button className="primary" title={`Download the ${rows.length} records on page ${pageNumber+1} as CSV`} disabled={loading||exporting||!rows.length} onClick={()=>void exportPage()}>{exporting?'Exporting...':'Export CSV'}</button>}{!['dashboard','new','intake'].includes(page)&&<button className="workbook-reload" aria-label="Reload records" title="Reload records" onClick={()=>setRevision(value=>value+1)} disabled={loading||summaryLoading}><RefreshCw size={14}/></button>}</div>
      <div className="header-controls">{accountMenu}</div>
    </div>
      {notice&&<div className="box live-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></button></div>}{setupError&&<div className="workbook-error" role="alert">{setupError}</div>}{counterError&&<div className="workbook-error" role="alert">Workflow/chat setup: {counterError}</div>}
      {page==='audit'&&profile.role==='CRO Manager'?<LiveAuditLogs revision={revision}/>:page==='intake'&&profile.role==='Client'?<LiveCaseIntake profile={profile} companies={options.companies} cities={options.cities} onCancel={()=>navigate('reports')} onCreated={id=>{setNotice(`Case ${id} raised and forwarded to your SFSO team for acknowledgement.`);setFilters(emptyFilters);setPageNumber(0);setRevision(value=>value+1);navigate(profile.role==='Client'?'reports':'new');}}/>:selected?<CaseDetail key={workbookKey(selected)} item={selected} profile={profile} onChange={()=>{setCounterRevision(value=>value+1);setRevision(value=>value+1);}} onBack={()=>setSelected(null)} onConversation={item=>{
        const target=groups.find(group=>profile.role==='FSO'?group.kind==='city'&&group.value===(item.city==='Rawalpindi'?'Islamabad':item.city):group.kind==='company'&&group.value===item.company)||groups.find(group=>group.kind==='city'&&group.value===(item.city==='Rawalpindi'?'Islamabad':item.city));
        if(target){navigate(target.key);setConversationCase(item);}else setNotice('No conversation group is configured for this case.');
      }}/>:page==='updates'?<section className="box"><h2>Updates to review</h2><button onClick={()=>{setFilters({...emptyFilters,status:'__review__'});setPageNumber(0);navigate('cases',true);}}>Field findings awaiting review ({counters?.reports_to_review??0})</button><h3>Group messages ({counters?.unread_messages??0} unread)</h3><div className="live-case-action-buttons">{groups.map(item=><button key={item.key} onClick={()=>navigate(item.key,true)}>{item.label}</button>)}</div></section>:group?<LiveGroupChat key={group.key} onOpenCase={setSelected} onStartDirectCall={()=>setDirectCallsOpen(true)} profile={profile} group={group} caseContext={conversationCase} onRead={()=>setCounterRevision(value=>value+1)}/>:<>
        {page==='dashboard'&&<>
          <div className="stats workbook-stats">
            <button className="stat" disabled={!counters} onClick={()=>{setFilters(emptyFilters);setPageNumber(0);navigate('new',true);}}><span>To acknowledge</span><b>{counters?.to_acknowledge.toLocaleString()??'Loading...'}</b></button>
            <button className="stat" disabled={!counters} onClick={openUpdates}><span>Updates to review</span><b>{internalUnreadCount.toLocaleString()}</b></button>
            <button className="stat" disabled={!counters} onClick={()=>{setFilters({...emptyFilters,status:'__active__'});setPageNumber(0);navigate('cases',true);}}><span>In progress</span><b>{counters?.in_progress.toLocaleString()??'Loading...'}</b></button>
            <button className="stat" onClick={()=>{setFilters({...emptyFilters,status:'Closed'});setPageNumber(0);navigate('cases',true);}}><span>Closed cases</span><b>{summaryLoading?'?':summary?.closed.toLocaleString()??'?'}</b></button>
          </div>
          <div className="box next"><div><div className="eyebrow">CRO ACTION DESK</div><h2>{counters?`${counters.to_acknowledge.toLocaleString()} New Cases Pending Review`:'Loading new cases...'}</h2></div><button className="primary new-cases-button" disabled={!counters} onClick={()=>{setFilters(emptyFilters);setPageNumber(0);navigate('new',true);}}>New Cases</button></div>
          <div className="box"><h2>Recent Activity</h2>{activityError&&<p className="workbook-error" role="alert">{activityError}</p>}{[...activity,...visits].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6).map(event=><div className="activity" key={event.id}><div><b>{{acknowledge:'Case acknowledged',start:'Field work started',arrive:'Officer arrived',report:'Field findings submitted',review:'Findings reviewed'}[event.action]||event.action}</b><small>{event.actor_name}{event.source_sheet?` / ${event.source_sheet} / Row ${event.source_row}`:''}</small></div><time dateTime={event.created_at}>{new Intl.DateTimeFormat('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'medium'}).format(new Date(event.created_at))+' PKT'}</time></div>)}</div>
        </>}
        {page!=='dashboard'&&<>
        {page==='reports'&&<div className="stats reports-stats"><div className="stat"><span>Total cases</span><b>{summaryLoading?'Loading...':summary?.total.toLocaleString()??'Unavailable'}</b></div><div className="stat"><span>Total exposure (PKR)</span><b>{summary?Number(summary.exposure).toLocaleString('en-PK',{maximumFractionDigits:2}):'Loading...'}</b></div><div className="stat"><span>Recovered (PKR)</span><b>{summary?Number(summary.recovered).toLocaleString('en-PK',{maximumFractionDigits:2}):'Loading...'}</b></div></div>}
        {showBoard&&<div className="stats workbook-stats case-board-stats">
          <button className="stat" type="button" onClick={()=>filter('status',filters.status==='__to_ack__'?'':'__to_ack__')}><span>To acknowledge</span><b>{counters?counters.to_acknowledge.toLocaleString():(summaryLoading?'...':rows.filter(item=>getCaseBoardStage(item)==='To acknowledge').length.toLocaleString())}</b></button>
          <button className="stat" type="button" onClick={()=>filter('status',filters.status==='__active__'?'':'__active__')}><span>In progress</span><b>{counters?counters.in_progress.toLocaleString():(summaryLoading?'...':rows.filter(item=>getCaseBoardStage(item)==='In progress').length.toLocaleString())}</b></button>
          <button className="stat" type="button" onClick={()=>filter('status',filters.status==='Closed'?'':'Closed')}><span>Closed</span><b>{summary?summary.closed.toLocaleString():(summaryLoading?'...':rows.filter(item=>getCaseBoardStage(item)==='Closed').length.toLocaleString())}</b></button>
        </div>}
        {profile.role==='FSO'&&error&&<div role="alert" className="workbook-error">{error}<button onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
        {<>
        {page!=='new'&&caseFilters}
        <div className="workbook-results" hidden={page==='new'}><span role="status">{loading?'Loading cases…':`${total.toLocaleString()} matching cases`}</span><small>{page==='reports'?`Export CSV includes this page (${rows.length} records)`:'Select a case to view details and actions'}</small></div>
        {error&&<div role="alert" className="workbook-error">Could not load cases. {error}<button onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
        {page==='new'?<div className="tw"><table className="new-cases-table workbook-table"><thead><tr><th colSpan={7} className="new-cases-filter-cell">{caseFilters}</th></tr><tr><th>Case ID</th><th>Company &amp; Hub</th><th>City</th><th>Issue</th><th>Exact Location</th><th>Priority</th><th>Actions</th></tr></thead><tbody>{rows.map(item=><tr key={workbookKey(item)}><td><button className="link" onClick={()=>setSelected(item)}><b>{sourceText(item.case_id)}</b></button><small>{sourceText(item.reported_date)}</small></td><td><b>{sourceText(item.company)}</b><small>{sourceText(item.hub)}</small></td><td><b>{sourceText(item.city)}</b></td><td><b>{sourceText(item.issue)}</b><small>PKR {sourceText(item.total_loss)}</small></td><td><button className="workbook-location" onClick={()=>setLocationItem(item)}><MapPin size={12}/><span>{sourceText(item.location)}</span></button></td><td><span className={'workbook-priority priority-'+String(item.priority||'').toLowerCase()}>{sourceText(item.priority)}</span></td><td><button className="primary" disabled={acknowledging!==null} onClick={()=>void acknowledge(item)}>{acknowledging===workbookKey(item)?'Saving...':'Acknowledge'}</button></td></tr>)}</tbody></table>{!loading&&!rows.length&&!error&&<div className="empty">No new intake cases awaiting review.</div>}</div>:showBoard?<div className="board stage-board">{BOARD_STAGES.map(stage=>{const stageCases=rows.filter(item=>getCaseBoardStage(item)===stage);return <section className="column workbook-stage-column workbook-city-column" key={stage}><h2>{stage}<small>{stageCases.length} on this page</small></h2>{!stageCases.length&&<p className="city-empty">No cases in this stage on this page.</p>}{stageCases.map(item=><article className="card workbook-board-card" key={workbookKey(item)}><div className="workbook-board-meta"><span className="workbook-company-mark"><CompanyMark company={sourceText(item.company)}/>{sourceText(item.company)}</span><span className={"workbook-priority priority-"+String(item.priority||'').toLowerCase()}>{sourceText(item.priority)}</span><span className="workbook-status">{workflowStage(item)||(item.status==='Pending'?'New':sourceText(item.status))}</span></div><button className="link" onClick={()=>setSelected(item)}><b>{sourceText(item.case_id)}</b></button><p>{sourceText(item.issue)}</p><small>{sourceText(item.city)} / {item.assigned_fso||'Unassigned'}</small><button className="workbook-location" onClick={()=>setLocationItem(item)}><MapPin size={12}/><span>{sourceText(item.location)}</span></button><small className="workbook-case-age">{caseAgeLabel(item.reported_date_iso as string|null|undefined) || 'Age unavailable'}</small></article>)}</section>;})}</div>:<div className="tw"><table className="reports-table workbook-table"><thead><tr><th>Case ID</th><th>Company & Hub</th><th>City</th><th>Issue</th><th>Exact location</th><th>Priority</th><th>Status</th><th>Total loss</th><th>Recovered</th>{page==='reports'&&<th>Official report</th>}</tr></thead><tbody>{rows.map(item=><tr key={workbookKey(item)}><td><button className="link" onClick={()=>setSelected(item)}><b>{sourceText(item.case_id)}</b></button><small>{sourceText(item.reported_date)}</small><small>Source row {item.source_row}</small></td><td><b>{sourceText(item.company)}</b><small>{sourceText(item.hub)}</small></td><td>{sourceText(item.city)}</td><td>{sourceText(item.issue)}</td><td><button className="workbook-location" onClick={()=>setLocationItem(item)}><MapPin size={12}/><span>{sourceText(item.location)}</span></button></td><td><span className={"workbook-priority priority-"+String(item.priority||'').toLowerCase()}>{sourceText(item.priority)}</span></td><td><span className={`workbook-status ${statusClass(item.status)}`}>{workflowStage(item)||(item.status==='Pending'?'New':sourceText(item.status))}</span></td><td>{sourceText(item.total_loss)}</td><td>{sourceText(item.recovered)}</td>{page==='reports'&&<td><button className="link live-report-icon" aria-label={`Generate report for ${sourceText(item.case_id)}, source row ${item.source_row}`} title="Generate report" onClick={()=>setReportItem(item)}><FileText size={18}/></button></td>}</tr>)}</tbody></table>{!loading&&!error&&!rows.length&&<div className="empty">{profile.role==='FSO'?`No cases are assigned to ${profile.officerName} in ${profile.city} matching these filters.`:'No cases match your filters and assigned access.'}</div>}</div>}
        </>}
        {pagination}
        </>}
      </>}
    </section></main>
    <nav className="mobile-bottom-bar" aria-label="Mobile navigation">{mobileNav.map(([key,label,Icon])=><button key={key} className={'mobile-bottom-item '+(page===key||(key==='dashboard'&&page==='new')?'active':'')} onClick={()=>navigate(key)}><Icon size={17}/><span>{label}</span></button>)}</nav>
  </GroupCallProvider>;
}
