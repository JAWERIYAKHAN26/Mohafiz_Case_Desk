-- New import tables only. Existing app/auth tables are not modified.
-- Run once in Supabase SQL Editor, then import the CSV files in the documented order.
begin;
create table public.workbook_import_batches (
  source_sha256 text primary key check(length(source_sha256)=64),
  source_filename text not null,
  source_sheet text not null,
  expected_cases integer not null,
  expected_notes integer not null,
  expected_links integer not null,
  imported_at timestamptz not null default now()
);
create table public.workbook_import_cases (
  source_sha256 text not null references public.workbook_import_batches(source_sha256),
  source_sheet text not null,
  source_row integer not null,
  source_row_sha256 text not null,
  serial_no text,
  reporting_day text,
  reporting_month text,
  reporting_year text,
  reported_date text,
  company text,
  city text,
  region text,
  incident_date text,
  reporting_delay_days text,
  issue text,
  case_id text,
  rider_name text,
  rider_phone text,
  rider_cnic text,
  customer_name text,
  customer_phone text,
  customer_cnic text,
  location text,
  coordinates text,
  consignment text,
  hub text,
  company_loss text,
  personal_loss text,
  total_loss text,
  recovered text,
  remaining_recovery text,
  description_cell text,
  findings_cell text,
  last_update_date text,
  assigned_fso text,
  status text,
  days_pending text,
  sla_breach text,
  delay_reason text,
  closure_date text,
  actions_taken text,
  actions_recommended text,
  rm_closing_remarks text,
  nom_closing_remarks text,
  police_station text,
  fir_status text,
  evidence_reference text,
  logged_by text,
  closed_by text,
  case_duration text,
  days_since_closure text,
  priority text,
  sla_formula_input text,
  score_formula_input text,
  fso_score text,
  total_score text,
  team_case_type text,
  closure_sla text,
  week text,
  description text,
  findings text,
  updates_added_by text,
  reported_date_iso date,
  incident_date_iso date,
  last_update_date_iso date,
  closure_date_iso date,
  company_loss_numeric numeric,
  personal_loss_numeric numeric,
  total_loss_numeric numeric,
  recovered_numeric numeric,
  remaining_recovery_numeric numeric,
  formula_metadata jsonb not null,
  raw_cell_metadata jsonb not null,
  primary key(source_sha256,source_sheet,source_row)
);
-- Case ID is deliberately non-unique: different source rows can share one ID.
create index workbook_import_cases_case_id on public.workbook_import_cases(case_id);
create index workbook_import_cases_company_city on public.workbook_import_cases(company,city);
create table public.workbook_import_notes (
  source_sha256 text not null references public.workbook_import_batches(source_sha256),
  source_note_id bigint not null,
  source_sheet text not null,
  source_cell text not null,
  source_row integer not null,
  source_column text not null,
  author text,
  note_text text not null,
  source_part text not null,
  primary key(source_sha256,source_note_id)
);
create index workbook_import_notes_cell on public.workbook_import_notes(source_sha256,source_sheet,source_row);
create table public.workbook_import_links (
  source_sha256 text not null references public.workbook_import_batches(source_sha256),
  source_link_id bigint not null,
  source_sheet text not null,
  source_ref text not null,
  target text,
  location text,
  display text,
  tooltip text,
  primary key(source_sha256,source_link_id)
);
alter table public.workbook_import_batches enable row level security;
revoke all on public.workbook_import_batches from anon, authenticated;
alter table public.workbook_import_cases enable row level security;
revoke all on public.workbook_import_cases from anon, authenticated;
alter table public.workbook_import_notes enable row level security;
revoke all on public.workbook_import_notes from anon, authenticated;
alter table public.workbook_import_links enable row level security;
revoke all on public.workbook_import_links from anon, authenticated;
-- Access policies will be added after the import is reconciled and the real user roster is mapped.
comment on column public.workbook_import_cases.serial_no is 'Excel A: S. No';
comment on column public.workbook_import_cases.reporting_day is 'Excel B: Day';
comment on column public.workbook_import_cases.reporting_month is 'Excel C: Month';
comment on column public.workbook_import_cases.reporting_year is 'Excel D: Year';
comment on column public.workbook_import_cases.reported_date is 'Excel E: Date of Reporting (Auto)';
comment on column public.workbook_import_cases.company is 'Excel F: Client';
comment on column public.workbook_import_cases.city is 'Excel G: City';
comment on column public.workbook_import_cases.region is 'Excel H: Region (Automated)';
comment on column public.workbook_import_cases.incident_date is 'Excel I: Date of Incident (DD-MON-YYYY)';
comment on column public.workbook_import_cases.reporting_delay_days is 'Excel J: Delay in Reporting - Days (Auto)';
comment on column public.workbook_import_cases.issue is 'Excel K: Issue (Drop-Down)';
comment on column public.workbook_import_cases.case_id is 'Excel L: Case ID (Automated)';
comment on column public.workbook_import_cases.rider_name is 'Excel M: Rider''s Name';
comment on column public.workbook_import_cases.rider_phone is 'Excel N: Rider''s Contact Format: 0321-2020202  (Conditional Formula Added)';
comment on column public.workbook_import_cases.rider_cnic is 'Excel O: Rider''s CNIC Format: 41303-1010101-0  (Conditional Formula Added)';
comment on column public.workbook_import_cases.customer_name is 'Excel P: Customer''s Name';
comment on column public.workbook_import_cases.customer_phone is 'Excel Q: Customer''s Contact Format: 0321-2020202  (Conditional Formula Added)';
comment on column public.workbook_import_cases.customer_cnic is 'Excel R: Customer''s CNIC Format: 41303-1010101-0  (Conditional Formula Added)';
comment on column public.workbook_import_cases.location is 'Excel S: Incident Location';
comment on column public.workbook_import_cases.coordinates is 'Excel T: Incident Location (Coordinates)';
comment on column public.workbook_import_cases.consignment is 'Excel U: Consignment #';
comment on column public.workbook_import_cases.hub is 'Excel V: Warehouse/Premises';
comment on column public.workbook_import_cases.company_loss is 'Excel W: Company Loss/GMV (Monetary Value Only -Conditional Formula Added)';
comment on column public.workbook_import_cases.personal_loss is 'Excel X: Personal Loss (Monetary Value Only -Conditional Formula Added)';
comment on column public.workbook_import_cases.total_loss is 'Excel Y: Total Monetary Loss  (Auto)';
comment on column public.workbook_import_cases.recovered is 'Excel Z: Recovered Amount (Monetary Value Only -Conditional Formula Added)';
comment on column public.workbook_import_cases.remaining_recovery is 'Excel AA: Remaining Recovery Amount  (Auto)';
comment on column public.workbook_import_cases.description_cell is 'Excel AB: Case Description (Add in Notes Only)  Need to add: Name of the effected  Cell Number(Active)';
comment on column public.workbook_import_cases.findings_cell is 'Excel AC: Findings (Add in Notes Only)';
comment on column public.workbook_import_cases.last_update_date is 'Excel AD: Last Date of Update (DD-MMM-YYYY)  Last Date of  Editing the Findings';
comment on column public.workbook_import_cases.assigned_fso is 'Excel AE: Mohafiz POC (Assigned FSO)';
comment on column public.workbook_import_cases.status is 'Excel AF: Case Status';
comment on column public.workbook_import_cases.days_pending is 'Excel AG: Days Pending  (Automated)';
comment on column public.workbook_import_cases.sla_breach is 'Excel AH: SLA Breach  (Automated)';
comment on column public.workbook_import_cases.delay_reason is 'Excel AI: Reason for Delay';
comment on column public.workbook_import_cases.closure_date is 'Excel AJ: Date of Case Closure (DD-MON-YY)';
comment on column public.workbook_import_cases.actions_taken is 'Excel AK: Actions Taken';
comment on column public.workbook_import_cases.actions_recommended is 'Excel AL: Actions Recommended';
comment on column public.workbook_import_cases.rm_closing_remarks is 'Excel AM: Closing Remarks - RM';
comment on column public.workbook_import_cases.nom_closing_remarks is 'Excel AN: Closing Remarks - NOM';
comment on column public.workbook_import_cases.police_station is 'Excel AO: Police Station (Mandatory with Legal Proceedings)';
comment on column public.workbook_import_cases.fir_status is 'Excel AP: Roznamcha/FIR Status (Drop-Down)';
comment on column public.workbook_import_cases.evidence_reference is 'Excel AQ: Pictorial Proof (Folder: Mohafiz Ops Sheet Data )';
comment on column public.workbook_import_cases.logged_by is 'Excel AR: Assigned CRO -Case Logged By (Drop-Down) Mandatory';
comment on column public.workbook_import_cases.closed_by is 'Excel AS: Assigned CRO -Case Closed By (Drop-Down) Mandatory';
comment on column public.workbook_import_cases.case_duration is 'Excel AT: Case Duration (Automated)';
comment on column public.workbook_import_cases.days_since_closure is 'Excel AU: Days Since Closing (Automated)';
comment on column public.workbook_import_cases.priority is 'Excel AV: Priority Type (Automated)';
comment on column public.workbook_import_cases.sla_formula_input is 'Excel AW: formulation 1';
comment on column public.workbook_import_cases.score_formula_input is 'Excel AX: formulation 2';
comment on column public.workbook_import_cases.fso_score is 'Excel AY: FSO Score -Acquired (Automated)';
comment on column public.workbook_import_cases.total_score is 'Excel AZ: Total Case Score  (Auto)';
comment on column public.workbook_import_cases.team_case_type is 'Excel BA: Cases types by team';
comment on column public.workbook_import_cases.closure_sla is 'Excel BB: Closoure SLA';
comment on column public.workbook_import_cases.week is 'Excel BC: Week';
comment on column public.workbook_import_cases.description is 'Excel BD: Case Description';
comment on column public.workbook_import_cases.findings is 'Excel BE: Findings';
comment on column public.workbook_import_cases.updates_added_by is 'Excel BF: Data Added By (Night Shift)/Updates added by ';
commit;