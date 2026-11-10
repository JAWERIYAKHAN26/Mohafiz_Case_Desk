import { supabase } from './supabase';

export type EvidenceKind = 'photo' | 'video' | 'voice';
export type FieldEvidence = { id: string; name: string; kind: EvidenceKind; type: string; size: number; url?: string; path?: string };
export type FieldSubmission = { id: string; text: string; author: string; at: string; attachments: FieldEvidence[]; demo: boolean };
export type SourceRecord = { sha256: string; sheet: string; row: number };
export const EVIDENCE_LIMIT = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 6;

export function evidenceKind(type: string): EvidenceKind | null {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) return 'photo';
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(type)) return 'video';
  if (['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'].includes(type.split(';')[0])) return 'voice';
  return null;
}

export async function persistFieldReport(source: SourceRecord | undefined, text: string, files: File[], onProgress: (value: string) => void): Promise<FieldSubmission> {
  if (!supabase || !source) throw new Error('Live case saving is not connected yet. Your draft is kept. Use the demo to preview attachments.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Sign in again before uploading evidence.');
  const id = crypto.randomUUID();
  const attachments: FieldEvidence[] = [];
  const uploaded: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const kind = evidenceKind(file.type);
      if (!kind || !file.size || file.size > EVIDENCE_LIMIT) throw new Error('Unsupported file or file larger than 25 MB.');
      onProgress(`Uploading file ${index + 1} of ${files.length}…`);
      const attachmentId = crypto.randomUUID();
      const path = `${user.id}/${id}/${attachmentId}`;
      const { error } = await supabase.storage.from('field-evidence').upload(path, file, { contentType: file.type.split(';')[0], upsert: false });
      if (error) throw error;
      uploaded.push(path);
      attachments.push({ id: attachmentId, name: file.name, kind, type: file.type, size: file.size, path });
    }
    onProgress('Saving report…');
    const { data, error } = await supabase.from('case_field_reports').insert({
      id, source_sha256: source.sha256, source_sheet: source.sheet, source_row: source.row,
      uploader_id: user.id, report_text: text, attachments,
    }).select('id,created_at').single();
    if (error) throw error;
    // Keep object paths as canonical references. Temporary links are only for preview.
    for (const item of attachments) {
      try {
        const { data: link } = await supabase.storage.from('field-evidence').createSignedUrl(item.path!, 3600);
        item.url = link?.signedUrl;
      } catch { /* The report is saved even if a temporary preview cannot be created. */ }
    }
    return { id: data.id, text, author: user.app_metadata.officer_name || user.email || 'FSO', at: data.created_at, attachments, demo: false };
  } catch (error) {
    if (uploaded.length) await supabase.storage.from('field-evidence').remove(uploaded);
    throw error;
  }
}
