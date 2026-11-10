"""Build a guarded, rerunnable SQL delta from the read-only workbook audit.

No network access. Never changes the workbook or live database.
Run from the repository root after the current-workbook-audit is refreshed.
"""
import csv
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path('outputs/current-workbook-audit')
SHA = '1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3'
REVISION = 'ef71ffe437902c872fb2f188b0e8ef5ec2dd6cbc5efd6f059e5f229b4de4bd70'
SHEET = 'B2B - 2025'


def read_rows(name):
    return [json.loads(line) for line in (ROOT / (name + '.ndjson')).read_text(encoding='utf-8-sig').splitlines()]


def date_value(value):
    if value is None or not str(value).strip():
        return None
    for fmt in ('%d-%b-%Y', '%d-%b-%y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    try:
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date().isoformat()
    except (ValueError, OverflowError):
        return None


def number_value(value):
    try:
        number = Decimal(str(value))
        return str(number) if number.is_finite() else None
    except InvalidOperation:
        return None


def sql_json(value):
    # Dollar quoting avoids SQL interpretation of workbook quotes and backslashes.
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    tag = '$workbook_' + hashlib.sha256(text.encode()).hexdigest()[:16] + '$'
    assert tag not in text
    return tag + text + tag + '::jsonb'


def build():
    mapping = {}
    for line in Path('outputs/sheet-audit/supabase-import/COLUMN_MAPPING.md').read_text(encoding='utf-8').splitlines():
        parts = line.split('|')
        if len(parts) == 5 and parts[1].strip().isalpha() and parts[1].strip().isupper():
            mapping[parts[1].strip()] = parts[3].strip()
    assert len(mapping) == 58
    db = sqlite3.connect('file:' + str(ROOT / 'workbook.sqlite') + '?mode=ro', uri=True)
    current = {row['source_row']: row for row in read_rows('workbook_import_cases')}
    missing = {item['source_row']: item['case_id'] for item in json.loads((ROOT / 'missing-cases.json').read_text())}
    candidates = []
    for row, ident in missing.items():
        cells = {col: (val, formula) for col, val, formula in db.execute(
            'select column_name,value,formula from cells where sheet=? and row=?', ('B2B - 202526', row))}
        assert cells['L'][0] == ident
        item = {field: cells.get(col, (None, None))[0] for col, field in mapping.items()}
        item.update(source_sha256=SHA, source_sheet=SHEET, source_row=row,
                    source_row_sha256=hashlib.sha256(json.dumps(cells, sort_keys=True).encode()).hexdigest(),
                    formula_metadata={col: {'expression': formula, 'source_revision': REVISION}
                                      for col, (_, formula) in cells.items() if formula is not None},
                    raw_cell_metadata={'origin': 'workbook-revision', 'revision_sha256': REVISION,
                                       'revision_sheet': 'B2B - 202526',
                                       'decoded_cells': {col: val for col, (val, _) in cells.items()}})
        for field in ('reported_date', 'incident_date', 'last_update_date', 'closure_date'):
            item[field + '_iso'] = date_value(item[field])
        for field in ('company_loss', 'personal_loss', 'total_loss', 'recovered', 'remaining_recovery'):
            item[field + '_numeric'] = number_value(item[field])
        candidates.append(item)
    # Apply only audited field deltas, never a full-row replacement. Preserve NULL vs ''.
    changes = {}
    calculated_fields = {'days_since_closure', 'days_pending', 'sla_breach', 'closure_sla',
                         'case_duration', 'score_formula_input', 'fso_score', 'priority',
                         'remaining_recovery', 'total_loss', 'team_case_type', 'updates_added_by'}
    with (ROOT / 'case-field-differences.csv').open(encoding='utf-8-sig') as file:
        for difference in csv.DictReader(file):
            row = int(difference['database_row'])
            field = difference['field']
            if field in calculated_fields:
                continue  # Read-time SQL recalculates these; do not rewrite 30k historical snapshots.
            column = next(col for col, name in mapping.items() if name == field)
            value = db.execute('select value from cells where sheet=? and row=? and column_name=?',
                               ('B2B - 202526', row, column)).fetchone()
            before, after = changes.setdefault(row, ({}, {}))
            before[field] = current[row].get(field)
            after[field] = value[0] if value else None
            if field in ('reported_date', 'incident_date', 'last_update_date', 'closure_date'):
                before[field + '_iso'] = current[row].get(field + '_iso')
                after[field + '_iso'] = date_value(after[field])
            if field in ('company_loss', 'personal_loss', 'total_loss', 'recovered', 'remaining_recovery'):
                before[field + '_numeric'] = current[row].get(field + '_numeric')
                after[field + '_numeric'] = number_value(after[field])
    # Keep backend recovery limits consistent with changed loss inputs as well as the view.
    for row, (before, after) in changes.items():
        if any(field in after for field in ('company_loss', 'personal_loss', 'recovered')):
            for column, field in [('Y', 'total_loss'), ('AA', 'remaining_recovery')]:
                value = db.execute('select value from cells where sheet=? and row=? and column_name=?',
                                   ('B2B - 202526', row, column)).fetchone()
                value = value[0] if value else None
                before[field] = current[row].get(field)
                before[field + '_numeric'] = current[row].get(field + '_numeric')
                after[field] = value
                after[field + '_numeric'] = number_value(value)
    old_notes = {item['source_cell']: item for item in read_rows('workbook_import_notes')}
    notes = []
    for sheet, cell, author, text in db.execute('select * from notes'):
        old = old_notes.get(cell)
        if old and old['note_text'] == text and (old.get('author') or '') == (author or ''):
            continue
        notes.append({'cell': cell, 'row': int(re.search(r'\d+$', cell)[0]),
                      'column': re.sub(r'\d+', '', cell), 'author': author, 'text': text,
                      'old': old})
    old_links = read_rows('workbook_import_links')
    existing_links = {(x['source_ref'], x['target'], x['location'], x['display'], x['tooltip']) for x in old_links}
    links = [dict(zip(['source_ref', 'target', 'location', 'display', 'tooltip'], row))
             for row in db.execute('select ref,target,location,display,tooltip from links where sheet=?', ('B2B - 202526',))
             if tuple(row) not in existing_links]
    payload = {'cases': candidates,
               'changes': [{'row': row, 'case_id': current[row]['case_id'], 'before': a, 'after': b}
                           for row, (a, b) in changes.items()], 'notes': notes, 'links': links}
    sql = Path('scripts/workbook/delta_transaction.sql').read_text(encoding='utf-8')
    sql = sql.replace('__PAYLOAD__', sql_json(payload)).replace('__REVISION__', REVISION).replace('__SHA__', SHA)
    (ROOT / 'IMPORT_LATEST_WORKBOOK.sql').write_text(sql, encoding='utf-8')
    (ROOT / 'delta-payload.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'new_cases': len(candidates), 'case_updates_for_guarded_review': len(changes),
                      'new_or_changed_notes': len(notes), 'new_links': len(links), 'live_writes': 0}))


if __name__ == '__main__':
    build()
