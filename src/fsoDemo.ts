import type { C } from './main';

export function restoreFsoDemoCases(cases: C[], officer: { name: string; city: string }): C[] {
  const assigned = cases.filter(item => item.officer === officer.name);
  const prefix = `DEMO-${officer.name.toUpperCase().replaceAll(' ', '-')}`;
  const base: C = {
    id: '', co: 'PostEx', hub: `PostEx ${officer.city} Hub`, city: officer.city,
    exactLocation: `Main Market, ${officer.city}`, incidentTime: '10:30 AM',
    riderName: 'Demo Rider', riderPhone: '0300-0000000', issue: 'Payment dispute',
    priority: 'High', stage: 'In progress', amount: 12500, recovered: 0, cls: '',
    officer: officer.name, date: '2026-10-28', accepted: false, fsoAcknowledged: false,
    description: 'Demo dispatch case for testing acknowledgement, arrival and field reports.',
    followUps: [], findings: [],
  };
  const samples: C[] = [];
  if (!assigned.some(item => item.stage === 'In progress' && !item.isQueued && !item.fsoAcknowledged && !item.accepted)) {
    samples.push({ ...base, id: `${prefix}-ACTIVE` });
  }
  if (!assigned.some(item => item.isQueued && item.stage !== 'Closed')) {
    samples.push({ ...base, id: `${prefix}-QUEUED`, co: 'Daraz', hub: `Daraz ${officer.city} Hub`,
      issue: 'Verification issue', priority: 'Medium', stage: 'Escalated', isQueued: true, queueOrder: 1 });
  }
  if (!assigned.some(item => item.stage !== 'Closed' && item.stage !== 'In progress' && !item.isQueued)) {
    samples.push({ ...base, id: `${prefix}-PENDING`, stage: 'Acknowledged', priority: 'Low',
      issue: 'Service complaint', description: 'Demo pending case awaiting field dispatch.' });
  }
  if (!assigned.some(item => item.stage === 'Closed')) {
    samples.push({ ...base, id: `${prefix}-CLOSED`, stage: 'Closed', recovered: 12500,
      accepted: true, fsoAcknowledged: true, arrived: true,
      report: 'Demo verification completed and the disputed amount recovered.',
      findings: [{ text: 'Demo case resolved after reconciliation and recovery.', author: 'CRO', at: '2026-10-28T14:00:00+05:00' }] });
  }
  // Stable IDs preserve edits and avoid adding the same demo case on repeat login.
  return [...cases, ...samples.filter(item => !cases.some(existing => existing.id === item.id))];
}
