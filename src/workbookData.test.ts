import test from 'node:test';
import assert from 'node:assert/strict';
import { workbookKey, sourceText, safeEvidenceUrl, workbookPageCsv, type WorkbookCase } from './workbookData';
import { workbookFields } from './workbookFields';
const row: WorkbookCase = { source_sha256: 'snapshot', source_sheet: 'B2B - 2025', source_row: 2, case_id: 'DUPLICATE' };
test('duplicate display IDs retain separate source identities', () => {
  assert.notEqual(workbookKey(row), workbookKey({...row, source_row:3}));
  assert.notEqual(workbookKey(row), workbookKey({...row, source_sheet:'Other'}));
  assert.notEqual(workbookKey(row), workbookKey({...row, source_sha256:'other'}));
});
test('source display preserves zero, leading zeros and whitespace', () => {
  assert.equal(sourceText(0), '0');
  assert.equal(sourceText('001234'), '001234');
  assert.equal(sourceText(' a\n '), ' a\n ');
  assert.equal(sourceText(null), '—');
});
test('only HTTP evidence links become navigable', () => {
  assert.equal(safeEvidenceUrl('javascript:alert(1)'), undefined);
  assert.equal(safeEvidenceUrl('file:///private'), undefined);
  assert.equal(safeEvidenceUrl('//example.com'), undefined);
  assert.equal(safeEvidenceUrl('https://example.com/evidence'), 'https://example.com/evidence');
});
test('exports cover all 58 fields and escape spreadsheet formulas and quotes', () => {
  assert.equal(workbookFields.length,58);
  assert.equal(new Set(workbookFields.map(field=>field.key)).size,58);
  const csv=workbookPageCsv([{...row,serial_no:'=1+1',description:'line 1\n"quoted"',recovered:'0'}]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"line 1\n""quoted"""'));
  assert.ok(csv.includes('"0"'));
});
