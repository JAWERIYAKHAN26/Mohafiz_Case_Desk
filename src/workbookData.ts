import { workbookFields } from './workbookFields';

export const WORKBOOK_SHA = '1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3';
export const WORKBOOK_PAGE_SIZE = 50;
export type WorkbookProfile = { role: string; name: string; email: string; city: string; company: string; officerName: string };
export type WorkbookCase = Record<string, string | number | null> & { source_sha256: string; source_sheet: string; source_row: number };
export type WorkbookNote = { source_note_id: number; source_cell: string; source_column: string; author: string | null; note_text: string };
export type WorkbookLink = { source_link_id: number; source_ref: string; target: string | null; location: string | null; display: string | null };
export type WorkbookSummary = { total: number; closed: number; pending: number; unclassified: number; exposure: string; recovered: string };
export const workbookSelect = ['source_sha256','source_sheet','source_row','source_row_sha256','reported_date_iso',...workbookFields.map(field => field.key)].join(',');
export const workbookListSelect = 'source_sha256,source_sheet,source_row,reported_date_iso,reported_date,case_id,company,hub,city,issue,location,coordinates,priority,status,total_loss,recovered,assigned_fso,rider_name,rider_phone';
export const workbookKey = (item: WorkbookCase) => JSON.stringify([item.source_sha256,item.source_sheet,item.source_row]);
export const sourceText = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? '—' : String(value);
export function caseAgeLabel(value: string | null | undefined, now = new Date()): string | undefined {
  if (!value) return;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return;
  const [year, month, day] = datePart.split('-').map(Number);
  const caseDay = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = Math.floor((today - caseDay) / 86_400_000);
  if (!Number.isFinite(difference) || difference < 0 || new Date(caseDay).toISOString().slice(0, 10) !== datePart) return;
  return difference === 0 ? 'Today' : difference === 1 ? '1 day ago' : `${difference} days ago`;
}
export function safeEvidenceUrl(value: string | null): string | undefined {
  if (!value) return;
  try { const url = new URL(value); if (url.protocol === 'https:' || url.protocol === 'http:') return url.href; } catch { /* Source reference is text, not a navigable URL. */ }
}
export function workbookPageCsv(rows: WorkbookCase[]): string {
  const quote = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return [workbookFields.map(field => field.label),...rows.map(row => workbookFields.map(field => row[field.key]))].map(row => row.map(quote).join(',')).join('\r\n');
}
