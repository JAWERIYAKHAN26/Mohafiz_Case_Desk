-- Apply AFTER portal workspace details. Source cells remain unchanged.
-- Workbook's standard formulas are evaluated at read time in Pakistan time.
-- Broken #REF! source formulas retain their cached values for review.
begin;
create table if not exists public.workbook_issue_rules(issue text primary key,sla_days numeric not null,priority text not null);
create table if not exists public.workbook_city_regions(city text primary key,region text not null);
alter table public.workbook_issue_rules enable row level security;
alter table public.workbook_city_regions enable row level security;
revoke all on public.workbook_issue_rules,public.workbook_city_regions from public,anon,authenticated;
grant select on public.workbook_issue_rules,public.workbook_city_regions to authenticated;
drop policy if exists workbook_rules_read on public.workbook_issue_rules;
create policy workbook_rules_read on public.workbook_issue_rules for select to authenticated using(true);
drop policy if exists workbook_regions_read on public.workbook_city_regions;
create policy workbook_regions_read on public.workbook_city_regions for select to authenticated using(true);

insert into public.workbook_issue_rules(issue,sla_days,priority) values
('Snatching',5.0,'P1'),
('Theft',5.0,'P2'),
('LEA Intervention',1.0,'P1'),
('Other',1.0,'P3'),
('Accident',1.0,'P1'),
('Harassment',1.0,'P2'),
('Robbery - On Premise',20.0,'P1'),
('Threat',1.0,'P1'),
('False Claim',1.0,'P2'),
('Physical Attack',1.0,'P1'),
('Kidnapping',8.0,'P1'),
('Substance Related',1.0,'P2'),
('DR Sheet Not Closed',2.0,'P3'),
('Colleague Support',1.0,'P2'),
('Security Awareness',1.0,'P3'),
('Reckless Driving',1.0,'P2'),
('Unauthorized Person',1.0,'P2'),
('Strike',5.0,'P1'),
('Fraudulent Activity',8.0,'P2'),
('Vendor/Retailer Involvement',2.0,'P3'),
('Held Hostage',5.0,'P1'),
('Stock Lost or Misplaced',7.0,'P2'),
('Forced Drop-off',1.0,'P2'),
('Customer Issue',2.0,'P1'),
('Fake Delivery',5.0,'P2'),
('Contact After Ride',1.0,'P2'),
('Cash Lost',5.0,'P2'),
('Mystery Shopping',1.0,'P3'),
('Lost & Found',1.0,'P2'),
('Impostor',1.0,'P2'),
('Sexual Harassment',1.0,'P2'),
('Vehicle Held by Driver',1.0,'P2'),
('Threats of Physical Harm',1.0,'P1'),
('Backup Support',1.0,'P2'),
('Counterfeit Product',30.0,'P3'),
('Unauthorized Sale',30.0,'P3'),
('Asset/Cash Recovery',30.0,'P3'),
('Cash Recovery',30.0,'P3'),
('BGC',3.0,'P3')
on conflict(issue) do update set sla_days=excluded.sla_days,priority=excluded.priority;
insert into public.workbook_city_regions(city,region) values
('Ain Sokhna','Egypt'),
('Alexandria','Egypt'),
('Cairo','Egypt'),
('Demitta','Egypt'),
('Giza','Egypt'),
('Harghada','Egypt'),
('Luxor','Egypt'),
('Sahel','Egypt'),
('Sharm El-Sheikh','Egypt'),
('Abbottabad','North'),
('Attock','North'),
('Bannu','North'),
('Batkhela','North'),
('Charsadda','North'),
('Chitral','North'),
('Dera Ismail Khan','North'),
('Dera Murad Jamali','North'),
('Dir','North'),
('Haripur','North'),
('Hasan Abdal','North'),
('Islamabad','North'),
('Kohat','North'),
('Mardan','North'),
('Mansehra','North'),
('Mingora','North'),
('Muzaffarabad','North'),
('Nowshera','North'),
('Peshawar','North'),
('Rawalpindi','North'),
('Swabi','North'),
('Timergara','North'),
('Topi','North'),
('Zhob','North'),
('Ahmadpur East','Central'),
('Bahawalnagar','Central'),
('Bahawalpur','Central'),
('Bhakkar','Central'),
('Bhalwal','Central'),
('Bhera','Central'),
('Chak Jhumra','Central'),
('Chakwal','Central'),
('Chiniot','Central'),
('Fateh Jang','Central'),
('Faisalabad','Central'),
('Fort Abbas','Central'),
('Gojra','Central'),
('Gujranwala','Central'),
('Gujrat','Central'),
('Hafizabad','Central'),
('Havelian','Central'),
('Jauharabad','Central'),
('Jhang','Central'),
('Jhelum','Central'),
('Kamalia','Central'),
('Kamoke','Central'),
('Kasur','Central'),
('Khanewal','Central'),
('Khanpur','Central'),
('Kharian','Central'),
('Khushab','Central'),
('Khuzdar','Central'),
('Kot Momin','Central'),
('Lahore','Central'),
('Lodhran','Central'),
('Malakwal','Central'),
('Mianwali','Central'),
('Mirpur Khas','Central'),
('Multan','Central'),
('Narowal','Central'),
('Nowshehra Virkan','Central'),
('Okara','Central'),
('Pakpattan','Central'),
('Pattoki','Central'),
('Renala Khurd','Central'),
('Rohri','Central'),
('Sadiqabad','Central'),
('Sahiwal','Central'),
('Sanghar','Central'),
('Shahkot','Central'),
('Sargodha','Central'),
('Sialkot','Central'),
('Taxila','Central'),
('Talagang','Central'),
('Toba Tek Singh','Central'),
('Vehari','Central'),
('Wah','Central'),
('Chichawatni','Central'),
('Rahimyar Khan','Central'),
('Wazirabad','Central'),
('Sheikhupura','Central'),
('Badin','South'),
('Bhit Shah','South'),
('Dadu','South'),
('Ghotki','South'),
('Hyderabad','South'),
('Jacobabad','South'),
('Jati','South'),
('Jiwani','South'),
('Karachi','South'),
('Khairpur','South'),
('Kotri','South'),
('Larkana','South'),
('Mirpur Bathoro','South'),
('Mirpur Sakro','South'),
('Mirwah','South'),
('Moro','South'),
('Naushahro Feroze','South'),
('Nawabshah','South'),
('Qambar','South'),
('Ranipur','South'),
('Shikarpur','South'),
('Sukkur','South'),
('Tando Adam','South'),
('Tando Allahyar','South'),
('Tando Muhammad Khan','South'),
('Thatta','South'),
('Turbat','South'),
('Hala','South'),
('Umerkot','South')
on conflict(city) do update set region=excluded.region;

create or replace function public.workbook_number(value text) returns numeric
language plpgsql immutable set search_path='' as $$
begin
 if value is null or btrim(value)='' or value !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then return null;end if;
 return value::numeric;
exception when numeric_value_out_of_range then return null;
end;$$;

create or replace function public.workbook_calculated(c jsonb,w jsonb default '{}'::jsonb,p_today date default (now() at time zone 'Asia/Karachi')::date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb:=c; calculated jsonb; lookup_priority text; lookup_sla numeric; city_region text;
 reported date; incident date; closed date; status text:=coalesce(w->>'stage','');
 company_amount numeric; personal_amount numeric; loss numeric; recovery numeric; duration integer; elapsed integer;
 sla numeric; score_input numeric; priority text; score numeric; max_score numeric; formula jsonb:=coalesce(c->'formula_metadata','{}');
 item record; portal boolean:=c->>'source_sheet'='Portal Intake'; recovered_formula boolean:=false;
begin
 reported:=nullif(c->>'reported_date_iso','')::date;incident:=nullif(c->>'incident_date_iso','')::date;
 closed:=nullif(c->>'closure_date_iso','')::date;
 if status='Closed' then
  closed:=coalesce(nullif(w->>'closed_date','')::date,closed);
 else status:=coalesce(c->>'status','');end if;
 select r.priority,r.sla_days into lookup_priority,lookup_sla from public.workbook_issue_rules r where lower(r.issue)=lower(c->>'issue');
 select r.region into city_region from public.workbook_city_regions r where lower(r.city)=lower(c->>'city');
 priority:=case when portal or formula ? 'AV' then coalesce(lookup_priority,'') else c->>'priority' end;
 sla:=case when portal or formula ? 'AW' then lookup_sla else public.workbook_number(c->>'sla_formula_input') end;
 company_amount:=public.workbook_number(c->>'company_loss');personal_amount:=public.workbook_number(c->>'personal_loss');
 loss:=case when portal or formula ? 'Y' then case when company_amount is not null or personal_amount is not null then coalesce(company_amount,0)+coalesce(personal_amount,0) end else public.workbook_number(c->>'total_loss') end;
 recovered_formula:=formula ? 'Z' and coalesce(formula->'Z'->>'expression','') like '%SUM(X%:Y%)%';
 recovery:=coalesce(public.workbook_number(w->>'recovered_amount'),case when recovered_formula then coalesce(personal_amount,0)+coalesce(loss,0) else public.workbook_number(c->>'recovered') end);
 if closed>=reported then duration:=closed-reported;end if;
 if reported<=p_today then elapsed:=p_today-reported;end if;
 if status<>'' and status<>'Pending' then score_input:=coalesce(sla,0)-coalesce(duration,0);end if;
 max_score:=case priority when 'P1' then 5 when 'P2' then 4 when 'P3' then 3 when 'P3DR' then 3 end;
 if status='Closed' and score_input is not null then
  if priority='P3DR' then score:=case when score_input in (29,30) then 0.1 when score_input between 0 and 28 then 3 when score_input<0 then 1 end;
  else score:=case when score_input>=0 then max_score when score_input between -3 and -1 then max_score*0.75 when score_input between -5 and -4 then max_score*0.3 when score_input< -5 then 0 end;end if;
 end if;
 calculated:=jsonb_build_object(
  'E',jsonb_build_object('reported_date',case when reported is null then '' else extract(day from reported)::integer||'-'||to_char(reported,'Mon-YYYY') end),
  'H',jsonb_build_object('region',case when coalesce(c->>'city','')='' then '' else coalesce(city_region,'Check City') end),
  'J',jsonb_build_object('reporting_delay_days',case when incident is null then '' when reported is null then '#VALUE!' else (reported-incident)::text end),
  'Y',jsonb_build_object('total_loss',coalesce(loss::text,''),'total_loss_numeric',loss),
  'AA',jsonb_build_object('remaining_recovery',case when loss is null and recovery is null then '' else (coalesce(loss,0)-coalesce(recovery,0))::text end,'remaining_recovery_numeric',case when loss is null and recovery is null then null else coalesce(loss,0)-coalesce(recovery,0) end),
  'AG',jsonb_build_object('days_pending',case when status='Closed' or reported is null then '' when elapsed is null then '#NUM!' else elapsed::text end),
  'AH',jsonb_build_object('sla_breach',case when status='Closed' or reported is null then '' when p_today-reported>coalesce(sla,0) then (coalesce(sla,0)-(p_today-reported))::text else '' end),
  'AT',jsonb_build_object('case_duration',coalesce(duration::text,'')),
  'AU',jsonb_build_object('days_since_closure',case when status='Closed' and closed is null then 'Check Date' when closed is not null and status<>'Closed' then 'Check Status' when status='Closed' and closed>p_today then '#NUM!' when status='Closed' then (p_today-closed)::text else '' end),
  'AV',jsonb_build_object('priority',coalesce(priority,'')),
  'AW',jsonb_build_object('sla_formula_input',coalesce(sla::text,'')),
  'AX',jsonb_build_object('score_formula_input',coalesce(score_input::text,'')),
  'AY',jsonb_build_object('fso_score',coalesce(score::text,'')),
  'AZ',jsonb_build_object('total_score',coalesce(max_score::text,'')),
  'BA',jsonb_build_object('team_case_type',case when reported=p_today-1 then 'yesterday' when reported<p_today-1 then 'old' else '' end),
  'BB',jsonb_build_object('closure_sla',case when reported is null then '' else (coalesce(closed,p_today)-reported)::text end),
  'BC',jsonb_build_object('week',case when reported is null then '' else (floor(((reported-make_date(extract(year from reported)::integer,1,1))+extract(dow from make_date(extract(year from reported)::integer,1,1)))/7)+1)::integer::text end),
  'BF',jsonb_build_object('updates_added_by',case when closed=p_today-1 then 'yesterday' when coalesce(closed,date '1899-12-30')<p_today-1 then 'old' else '' end));
 for item in select key,value from jsonb_each(calculated) loop
  if (portal or formula ? item.key) and coalesce(formula->item.key->>'expression','') not like '%#REF!%'
   and coalesce(c->'raw_cell_metadata'->item.key->>'type','')<>'e'
   and not exists(select 1 from regexp_matches(coalesce(formula->item.key->>'expression',''),'([A-Z]+)([0-9]+)','g') refs
    where refs[2]::integer<>(c->>'source_row')::integer) then result:=result||item.value;end if;
 end loop;
 -- Effective workflow values win over imported snapshots.
 if w->>'assigned_fso' is not null then result:=result||jsonb_build_object('assigned_fso',w->>'assigned_fso');end if;
 if w->>'recovered_amount' is not null then result:=result||jsonb_build_object('recovered',recovery::text,'recovered_numeric',recovery);end if;
 if recovered_formula and w->>'recovered_amount' is null then result:=result||jsonb_build_object('recovered',recovery::text,'recovered_numeric',recovery);end if;
 if w->>'stage'='Closed' then result:=result||jsonb_build_object('status','Closed','closure_date_iso',closed,'closure_date',closed::text);end if;
 return result;
end;$$;
revoke all on function public.workbook_number(text),public.workbook_calculated(jsonb,jsonb,date) from public,anon;
grant execute on function public.workbook_number(text),public.workbook_calculated(jsonb,jsonb,date) to authenticated;

-- Security invoker keeps underlying case and workflow RLS authoritative.
create or replace view public.workbook_effective_cases with(security_invoker=true) as
select c.source_sha256,c.source_sheet,c.source_row,calculated.source_row_sha256,calculated.serial_no,calculated.reporting_day,calculated.reporting_month,calculated.reporting_year,calculated.reported_date,calculated.company,calculated.city,calculated.region,calculated.incident_date,calculated.reporting_delay_days,calculated.issue,calculated.case_id,calculated.rider_name,calculated.rider_phone,calculated.rider_cnic,calculated.customer_name,calculated.customer_phone,calculated.customer_cnic,calculated.location,calculated.coordinates,calculated.consignment,calculated.hub,calculated.company_loss,calculated.personal_loss,calculated.total_loss,calculated.recovered,calculated.remaining_recovery,calculated.description_cell,calculated.findings_cell,calculated.last_update_date,calculated.assigned_fso,calculated.status,calculated.days_pending,calculated.sla_breach,calculated.delay_reason,calculated.closure_date,calculated.actions_taken,calculated.actions_recommended,calculated.rm_closing_remarks,calculated.nom_closing_remarks,calculated.police_station,calculated.fir_status,calculated.evidence_reference,calculated.logged_by,calculated.closed_by,calculated.case_duration,calculated.days_since_closure,calculated.priority,calculated.sla_formula_input,calculated.score_formula_input,calculated.fso_score,calculated.total_score,calculated.team_case_type,calculated.closure_sla,calculated.week,calculated.description,calculated.findings,calculated.updates_added_by,calculated.reported_date_iso,calculated.incident_date_iso,calculated.last_update_date_iso,calculated.closure_date_iso,calculated.company_loss_numeric,calculated.personal_loss_numeric,calculated.total_loss_numeric,calculated.recovered_numeric,calculated.remaining_recovery_numeric,calculated.formula_metadata,calculated.raw_cell_metadata from public.workbook_import_cases c
left join public.case_workflow w using(source_sha256,source_sheet,source_row)
cross join lateral jsonb_populate_record(null::public.workbook_import_cases,
 public.workbook_calculated(to_jsonb(c),coalesce(to_jsonb(w),'{}')||jsonb_build_object('closed_date',
  (select (max(e.created_at) at time zone 'Asia/Karachi')::date from public.case_workflow_events e
   where (e.source_sha256,e.source_sheet,e.source_row)=(c.source_sha256,c.source_sheet,c.source_row) and e.action='close')))) calculated;
revoke all on public.workbook_effective_cases from public,anon;
grant select on public.workbook_effective_cases to authenticated;
create or replace function public.desk_case_list(p_sha text,p_filters jsonb default '{}'::jsonb,p_page integer default 0,p_size integer default 50) returns jsonb
language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select c.*,w.stage as desk_stage,w.assigned_fso as desk_officer,w.recovered_amount as desk_recovered
  from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha
   and (coalesce(p_filters->>'company','')='' or c.company=p_filters->>'company')
   and (coalesce(p_filters->>'city','')='' or c.city=p_filters->>'city')
   and (coalesce(p_filters->>'priority','')='' or (case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce((select priority from public.workbook_issue_rules where lower(issue)=lower(c.issue)),'') else c.priority end)=p_filters->>'priority')
   and (coalesce(trim(p_filters->>'search'),'')='' or position(lower(trim(p_filters->>'search')) in lower(c.case_id))>0)
   and (nullif(p_filters->>'from','') is null or c.reported_date_iso>=(p_filters->>'from')::date)
   and (nullif(p_filters->>'to','') is null or c.reported_date_iso<=(p_filters->>'to')::date)
   and case coalesce(p_filters->>'status','')
    when '' then true
    when '__to_ack__' then c.status='Pending' and (w.stage is null or w.stage='New')
    when '__active__' then c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')
    when '__review__' then c.status is distinct from 'Closed' and w.stage='Submitted'
    when '__open__' then c.status is distinct from 'Closed' and w.stage is distinct from 'Closed'
    when '__blank__' then (c.status is null or c.status='') and w.stage is distinct from 'Closed'
    when 'Closed' then c.status='Closed' or w.stage='Closed'
    when 'Pending' then c.status='Pending' and (w.stage is null or w.stage in ('New','Acknowledged'))
    else c.status=p_filters->>'status' and w.stage is distinct from 'Closed' end
   and (coalesce(auth.jwt()->'app_metadata'->>'role','')<>'FSO' or (c.city=auth.jwt()->'app_metadata'->>'city' and coalesce(w.assigned_fso,c.assigned_fso)=auth.jwt()->'app_metadata'->>'officer_name'))
 ), paged as (
  select * from filtered order by reported_date_iso desc nulls last,source_sheet,source_row desc
  limit greatest(1,least(p_size,100)) offset greatest(0,p_page)*greatest(1,least(p_size,100))
 )
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(
  public.workbook_calculated(to_jsonb(p)-'desk_stage'-'desk_officer'-'desk_recovered',jsonb_build_object('stage',p.desk_stage,'assigned_fso',p.desk_officer,'recovered_amount',p.desk_recovered,'closed_date',(select (max(e.created_at) at time zone 'Asia/Karachi')::date from public.case_workflow_events e where (e.source_sha256,e.source_sheet,e.source_row)=(p.source_sha256,p.source_sheet,p.source_row) and e.action='close'))) ||jsonb_build_object(
   'case_workflow',case when p.desk_stage is null then null else jsonb_build_object('stage',p.desk_stage) end
  ) order by p.reported_date_iso desc nulls last,p.source_sheet,p.source_row desc
 ) from paged p),'[]'::jsonb));
$$;
revoke all on function public.desk_case_list(text,jsonb,integer,integer) from public,anon;
grant execute on function public.desk_case_list(text,jsonb,integer,integer) to authenticated;

create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'closed',count(*) filter(where c.status='Closed' or w.stage='Closed'),
  'pending',count(*) filter(where c.status='Pending' and (w.stage is null or w.stage in ('New','Acknowledged'))),
  'unclassified',count(*) filter(where (c.status is null or c.status='') and w.stage is distinct from 'Closed'),
  'exposure',coalesce(sum(case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'Y' then coalesce(c.company_loss_numeric,0)+coalesce(c.personal_loss_numeric,0) else c.total_loss_numeric end),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
 and (coalesce(auth.jwt()->'app_metadata'->>'role','')<>'FSO' or (c.city=auth.jwt()->'app_metadata'->>'city' and coalesce(w.assigned_fso,c.assigned_fso)=auth.jwt()->'app_metadata'->>'officer_name'));
$$;
create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'companies',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''),'[]'::jsonb),
  'cities',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''),'[]'::jsonb),
  'statuses',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''),'[]'::jsonb),
  'priorities',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''),'[]'::jsonb))
 from (select c.company,c.city,c.status,case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce(r.priority,'') else c.priority end as priority from public.workbook_import_cases c left join public.workbook_issue_rules r on lower(r.issue)=lower(c.issue) where c.source_sha256=p_source_sha) options;
$$;
create or replace function public.workflow_counters(p_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'to_acknowledge',count(*) filter(where c.status='Pending' and (w.stage is null or w.stage='New')),
  'in_progress',count(*) filter(where c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')),
  'reports_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted'),
  'unread_messages',public.workspace_unread_count(),
  'updates_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted')+public.workspace_unread_count())
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row) where c.source_sha256=p_sha;
$$;

create or replace function public.portal_create_case(p_sha text,p_request uuid,p_data jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
 metadata jsonb:=auth.jwt()->'app_metadata'; role_name text:=metadata->>'role';
 company_name text:=trim(p_data->>'company'); city_name text:=trim(p_data->>'city');
 today date:=(now() at time zone 'Asia/Karachi')::date; incident date;
 prefix text; generated text; next_number bigint; row_number integer; amount numeric; personal_amount numeric; company_amount numeric; prior public.portal_case_requests%rowtype;
begin
 if auth.uid() is null or role_name is null or role_name<>'Client' then raise exception 'Case creation is not permitted'; end if;
 if p_request is null or p_sha is null or p_sha<>'1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3' then raise exception 'Invalid case request'; end if;
 company_name:=metadata->>'company';
 if company_name is null or city_name is null or not exists(select 1 from public.workbook_import_cases where source_sha256=p_sha and company=company_name) or not exists(select 1 from public.workbook_import_cases where source_sha256=p_sha and city=city_name) then raise exception 'Select a known company and city'; end if;
 if not coalesce(public.workbook_row_readable(company_name,city_name,null),false) then raise exception 'Case outside your coverage'; end if;
 if coalesce(length(trim(p_data->>'hub')),0) not between 1 and 200
 or coalesce(length(trim(p_data->>'location')),0) not between 1 and 2000
 or coalesce(length(trim(p_data->>'description')),0) not between 10 and 10000
 or coalesce(length(trim(p_data->>'rider_name')),0) not between 1 and 200
 or coalesce(length(trim(p_data->>'rider_phone')),0) not between 1 and 50
 or coalesce(length(trim(p_data->>'issue')),0) not between 1 and 200
 or not exists(select 1 from public.workbook_issue_rules where issue=trim(p_data->>'issue')) then raise exception 'Complete the required case information'; end if;
 amount:=(p_data->>'amount')::numeric;
 company_amount:=amount;personal_amount:=coalesce(nullif(p_data->>'personal_loss','')::numeric,0);
 if company_amount<0 or personal_amount<0 or personal_amount>999999999999 then raise exception 'Invalid loss amount';end if;
 amount:=amount+personal_amount;
 incident:=(p_data->>'incident_date')::date;
 if amount is null or amount<0 or amount>999999999999 or incident is null or incident>today then raise exception 'Invalid amount or incident date'; end if;
 -- One transaction allocates both the display ID and row key; retries return the saved ID.
 perform pg_catalog.pg_advisory_xact_lock(6472491104);
 select * into prior from public.portal_case_requests where request_id=p_request;
 if found then
  if prior.actor_id<>auth.uid() or prior.source_sha256<>p_sha then raise exception 'Request belongs to a different session'; end if;
  return prior.case_id;
 end if;
 prefix:=upper(left(company_name,3)||'-'||left(city_name,3)||'-'||to_char(today,'MON-YY')||'-');
 select coalesce(max(n),0)+1 into next_number from (
  select substring(case_id from length(prefix)+1)::bigint as n
  from public.workbook_import_cases where left(case_id,length(prefix))=prefix and substring(case_id from length(prefix)+1)~'^[0-9]{1,12}$'
  union all
  select substring(case_id from length(prefix)+1)::bigint
  from public.portal_case_requests where left(case_id,length(prefix))=prefix and substring(case_id from length(prefix)+1)~'^[0-9]{1,12}$'
 ) allocated;
 generated:=prefix||next_number;
 row_number:=nextval('public.portal_case_rows')::integer;
 insert into public.workbook_import_cases(source_sha256,source_sheet,source_row,source_row_sha256,case_id,company,city,hub,issue,priority,location,rider_name,rider_phone,reported_date,reported_date_iso,incident_date,incident_date_iso,reporting_month,reporting_year,total_loss,total_loss_numeric,company_loss,company_loss_numeric,recovered,recovered_numeric,status,description,logged_by,formula_metadata,raw_cell_metadata)
 values(p_sha,'Portal Intake',row_number,repeat(md5(p_request::text),2),generated,company_name,city_name,trim(p_data->>'hub'),trim(p_data->>'issue'),(select priority from public.workbook_issue_rules where issue=trim(p_data->>'issue')),trim(p_data->>'location'),trim(p_data->>'rider_name'),trim(p_data->>'rider_phone'),today::text,today,incident::text,incident,to_char(today,'Mon'),to_char(today,'YYYY'),amount::text,amount,company_amount::text,company_amount,'0',0,'Pending',trim(p_data->>'description'),coalesce(metadata->>'display_name',role_name),'{}'::jsonb,jsonb_build_object('origin','portal','request_id',p_request,'created_by',auth.uid()));
 update public.workbook_import_cases set serial_no=(select (coalesce(max(public.workbook_number(serial_no)),0)+1)::text from public.workbook_import_cases where source_sha256=p_sha), reporting_day=extract(day from today)::integer::text, region=(select region from public.workbook_city_regions where city=city_name), customer_name=nullif(trim(p_data->>'customer_name'),''),customer_phone=nullif(trim(p_data->>'customer_phone'),''),customer_cnic=nullif(trim(p_data->>'customer_cnic'),''),rider_cnic=nullif(trim(p_data->>'rider_cnic'),''),coordinates=nullif(trim(p_data->>'coordinates'),''),consignment=nullif(trim(p_data->>'consignment'),''),personal_loss=personal_amount::text,personal_loss_numeric=personal_amount where source_sha256=p_sha and source_sheet='Portal Intake' and source_row=row_number;
 insert into public.portal_case_requests values(p_request,auth.uid(),p_sha,row_number,generated);
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,actor_id,actor_name)
 values(p_sha,'Portal Intake',row_number,'Raised a case',auth.uid(),coalesce(metadata->>'display_name',role_name));
 return generated;
end; $$;
revoke all on function public.portal_create_case(text,uuid,jsonb) from public,anon;
grant execute on function public.portal_create_case(text,uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
