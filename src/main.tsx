import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck, LayoutDashboard, Inbox, Columns3, MessagesSquare, MessageSquareLock,
  Tags, ChartNoAxesCombined, History, ArrowUpRight, Users, BriefcaseBusiness,
  PlusCircle, Sun, Moon, LogOut, UserRound, MapPin, Phone, Clock, Building2,
  CheckCircle2, AlertCircle, Navigation, Radio, Send, X, ExternalLink, Check, AlertTriangle,
  Eye, EyeOff, FileText, Printer, Paperclip, Menu
} from 'lucide-react';
import './theme-desk.css';
import FollowUps, { type FollowUpItem } from './FollowUps';

// Dedicated type for official CRO manual findings
export type CaseFinding = {
  text: string;
  author: string;
  at: string;
  files?: { name: string; url: string }[];
};

// Page Icons & Categories
const pageIcons: Record<string, typeof ShieldCheck> = {
  'Today': LayoutDashboard,
  'New Cases': Inbox,
  'Case Board': Columns3,
  'Client Updates': MessagesSquare,
  'Follow-Ups / Findings': History,
  'Internal Case Group': MessageSquareLock,
  'Case Group': MessageSquareLock,
  'Classification': Tags,
  'Reports': ChartNoAxesCombined,
  'Audit Logs': History,
  'Escalations': ArrowUpRight,
  'Field Team': Users,
  'My Cases': BriefcaseBusiness,
  'Raise a Case': PlusCircle,
};

const categories: Record<string, string> = {
  'Today': 'OVERVIEW',
  'New Cases': 'INTAKE',
  'Case Board': 'CASE MANAGEMENT',
  'Client Updates': 'COMMUNICATION',
  'Follow-Ups / Findings': 'INVESTIGATION',
  'Internal Case Group': 'COMMUNICATION',
  'Case Group': 'COMMUNICATION',
  'Classification': 'INVESTIGATION',
  'Reports': 'ANALYTICS',
  'Audit Logs': 'ACTIVITY',
  'Escalations': 'ASSIGNMENTS & DISPATCH',
  'Field Team': 'OPERATIONS & WORKLOAD',
  'My Cases': 'FIELD WORKSPACE',
  'Raise a Case': 'INTAKE',
};

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ShieldCheck size={23} aria-hidden="true" />
      </span>
      <div>
        Mohafiz
        <small>CASE DESK</small>
      </div>
    </div>
  );
}

// Case Data Type
export type C = {
  id: string;
  co: string; // Company: PostEx, Daraz, Buscaro
  hub: string; // Hub: e.g. PostEx Pindi Hub
  city: string;
  exactLocation: string; // Exact location reported by client
  incidentTime: string; // Incident time: e.g. 14:30
  riderName: string; // Rider name: e.g. Muhammad Zeeshan
  riderPhone: string; // Rider contact: e.g. 0300-1234567
  issue: string;
  priority: string;
  stage: string;
  amount: number;
  recovered: number;
  cls: string;
  officer: string;
  date: string;
  isQueued?: boolean;
  queueOrder?: number;
  description?: string;
  victim?: string;
  branch?: string;
  tat?: string;
  initialRemarks?: string;
  accepted?: boolean;
  arrived?: boolean;
  report?: string;
  findings?: CaseFinding[];
  followUps?: FollowUpItem[];
  source?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  busyReason?: string;
  busyByOfficer?: string;
  busyReportedAt?: string;
  fsoAcknowledged?: boolean;
  fsoAcknowledgedAt?: string;
};

// 3 SFSOs - One for Islamabad, One for Lahore, One for Karachi
export const sfsoDesks: Record<string, { name: string; city: string; title: string }> = {
  'Islamabad': { name: 'Ahmed', city: 'Islamabad', title: 'SFSO Islamabad Desk' },
  'Lahore': { name: 'Hamza', city: 'Lahore', title: 'SFSO Lahore Desk' },
  'Karachi': { name: 'Tariq', city: 'Karachi', title: 'SFSO Karachi Desk' },
};

// Field Service Officers (FSOs) organized across every city
export const officers = [
  // Islamabad FSOs
  { name: 'Sara Ahmed', city: 'Islamabad', phone: '0333-6665432' },
  { name: 'Kamran Khan', city: 'Islamabad', phone: '0331-5554321' },
  // Rawalpindi FSOs
  { name: 'Usman Tariq', city: 'Rawalpindi', phone: '0345-5559876' },
  { name: 'Haris Mehmood', city: 'Rawalpindi', phone: '0346-7778899' },
  // Lahore FSOs
  { name: 'Zubair Shah', city: 'Lahore', phone: '0302-9988776' },
  { name: 'Bilal Hassan', city: 'Lahore', phone: '0321-7774321' },
  { name: 'Hamid Ali', city: 'Lahore', phone: '0322-4445566' },
  // Karachi FSOs
  { name: 'Ali Raza', city: 'Karachi', phone: '0300-8881234' },
  { name: 'Farhan Qureshi', city: 'Karachi', phone: '0312-7776543' },
  { name: 'Waqas Siddiqui', city: 'Karachi', phone: '0301-2223344' },
  // Peshawar FSOs
  { name: 'Naveed Afridi', city: 'Peshawar', phone: '0315-9991122' },
  { name: 'Gul Khan', city: 'Peshawar', phone: '0313-8887766' },
];

export const officerNames = officers.map(o => o.name);
const stages = ['New', 'Acknowledged', 'Escalated', 'In progress', 'Hold', 'Closed'];
const companies = ['PostEx', 'Daraz', 'Buscaro'];
const cities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar'];

// Helper to check city match for SFSO (Islamabad covers Islamabad & Rawalpindi twin cities)
export const sfsoCityMatches = (caseCity: string, sfsoCity: string) => {
  if (sfsoCity === 'Islamabad') {
    return caseCity === 'Islamabad' || caseCity === 'Rawalpindi';
  }
  return caseCity.toLowerCase() === sfsoCity.toLowerCase();
};

// Hubs tailored by client
const clientHubs: Record<string, string[]> = {
  'PostEx': [
    'PostEx Pindi Hub',
    'PostEx Islamabad I-9 Hub',
    'PostEx Karachi Korangi Hub',
    'PostEx Lahore Gulberg Hub',
    'PostEx Rawalpindi Satellite Town Hub',
    'PostEx Peshawar Central Hub',
  ],
  'Daraz': [
    'Daraz Pindi Logistics Hub',
    'Daraz Islamabad Hub',
    'Daraz Karachi Central Hub',
    'Daraz Lahore Hub',
  ],
  'Buscaro': [
    'Buscaro Islamabad Hub',
    'Buscaro Lahore Hub',
    'Buscaro Karachi Hub',
  ],
};

const nav: Record<string, string[]> = {
  CRO: ['Today', 'New Cases', 'Case Board', 'Client Updates', 'Internal Case Group', 'Classification', 'Follow-Ups / Findings', 'Reports', 'Audit Logs'],
  SFSO: ['Escalations', 'Case Board', 'Client Updates', 'Internal Case Group', 'Field Team'],
  FSO: ['My Cases', 'Case Group'],
  Client: ['My Cases', 'Raise a Case', 'Client Updates', 'Reports'],
};

// Initial state with cases across Islamabad, Lahore, and Karachi
const initial: C[] = [
  // Islamabad / Rawalpindi Cases
  {
    id: 'POS-RAW-OCT-26-1',
    co: 'PostEx',
    hub: 'PostEx Pindi Hub',
    city: 'Rawalpindi',
    exactLocation: 'Shop #12, Commercial Market, Satellite Town, Rawalpindi',
    incidentTime: '11:15 AM',
    riderName: 'Muhammad Bilal',
    riderPhone: '0301-5551122',
    issue: 'Payment dispute',
    priority: 'High',
    stage: 'New',
    amount: 37800,
    recovered: 0,
    cls: '',
    officer: '',
    date: '2026-10-28',
    description: 'Customer claims parcel received but COD payment of PKR 37,800 was never credited to rider or system.',
  },
  {
    id: 'DAR-ISL-OCT-26-1',
    co: 'Daraz',
    hub: 'Daraz Islamabad Hub',
    city: 'Islamabad',
    exactLocation: 'Plaza 4B, Sector I-9/3 Industrial Area, Islamabad',
    incidentTime: '10:00 AM',
    riderName: 'Kamran Ali',
    riderPhone: '0312-4443322',
    issue: 'Verification issue',
    priority: 'Medium',
    stage: 'New',
    amount: 2500,
    recovered: 0,
    cls: '',
    officer: '',
    date: '2026-10-28',
    description: 'Consignee address discrepancy and physical verification required before releasing high-value electronics consignment.',
  },
  {
    id: 'POS-ISL-OCT-26-1',
    co: 'PostEx',
    hub: 'PostEx Islamabad I-9 Hub',
    city: 'Islamabad',
    exactLocation: 'Sector F-7 Markaz, Jinnah Super, Islamabad',
    incidentTime: '01:00 PM',
    riderName: 'Farhan Saeed',
    riderPhone: '0344-1122334',
    issue: 'Snatching',
    priority: 'High',
    stage: 'In progress',
    amount: 18500,
    recovered: 0,
    cls: '',
    officer: 'Sara Ahmed', // Sara Ahmed (Islamabad) is BUSY; Usman Tariq (Islamabad/Pindi) is FREE
    date: '2026-10-28',
    accepted: true,
    fsoAcknowledged: true,
    fsoAcknowledgedAt: '01:05 PM',
    description: 'Armed robbery incident. Cash bag and mobile confiscated. Sara Ahmed is investigating with local police.',
  },

  // Lahore Cases
  {
    id: 'BUS-LAH-OCT-26-1',
    co: 'Buscaro',
    hub: 'Buscaro Lahore Hub',
    city: 'Lahore',
    exactLocation: 'Main Boulevard, Near Liberty Roundabout, Gulberg III, Lahore',
    incidentTime: '09:45 AM',
    riderName: 'Tariq Mehmood',
    riderPhone: '0334-2221199',
    issue: 'Service complaint',
    priority: 'Low',
    stage: 'New',
    amount: 2750,
    recovered: 0,
    cls: '',
    officer: '',
    date: '2026-10-28',
    description: 'Complaint regarding passenger baggage verification and route diversion along Gulberg corridor.',
  },
  {
    id: 'POS-LAH-OCT-26-1',
    co: 'PostEx',
    hub: 'PostEx Lahore Gulberg Hub',
    city: 'Lahore',
    exactLocation: 'Mall Road, near Charing Cross, Lahore',
    incidentTime: '08:30 AM',
    riderName: 'Hamza Rafiq',
    riderPhone: '0304-4455667',
    issue: 'Theft',
    priority: 'High',
    stage: 'In progress',
    amount: 27950,
    recovered: 0,
    cls: '',
    officer: 'Zubair Shah', // Zubair Shah (Lahore) is BUSY; Bilal Hassan (Lahore) is FREE
    date: '2026-10-28',
    accepted: true,
    fsoAcknowledged: true,
    fsoAcknowledgedAt: '08:35 AM',
    arrived: true,
    description: 'Cash collection bag snatched during evening delivery run. Zubair Shah deployed on-site.',
  },

  // Karachi Cases
  {
    id: 'POS-KAR-OCT-26-1',
    co: 'PostEx',
    hub: 'PostEx Karachi Korangi Hub',
    city: 'Karachi',
    exactLocation: 'Sector 15, Korangi Industrial Area, Karachi',
    incidentTime: '11:40 AM',
    riderName: 'Arshad Mehmood',
    riderPhone: '0300-3344556',
    issue: 'Cash Discrepancy',
    priority: 'High',
    stage: 'New',
    amount: 42000,
    recovered: 0,
    cls: '',
    officer: '',
    date: '2026-10-28',
    description: 'COD collection amount mismatch reported at Korangi hub dispatch desk.',
  },
  {
    id: 'DAR-KAR-OCT-26-1',
    co: 'Daraz',
    hub: 'Daraz Karachi Central Hub',
    city: 'Karachi',
    exactLocation: 'Block 4, Marine Drive, Clifton, Karachi',
    incidentTime: '12:20 PM',
    riderName: 'Rashid Khan',
    riderPhone: '0315-7788990',
    issue: 'Fake delivery',
    priority: 'Medium',
    stage: 'In progress',
    amount: 16090,
    recovered: 0,
    cls: '',
    officer: 'Ali Raza', // Ali Raza (Karachi) is BUSY; Farhan Qureshi (Karachi) is FREE
    date: '2026-10-28',
    accepted: true,
    fsoAcknowledged: true,
    fsoAcknowledgedAt: '12:25 PM',
    description: 'Customer claims parcel marked delivered without physical receipt. Signature forged on device.',
  },

  // Peshawar Cases
  {
    id: 'POS-PES-OCT-26-1',
    co: 'PostEx',
    hub: 'PostEx Peshawar Central Hub',
    city: 'Peshawar',
    exactLocation: 'Saddar Road, near Cantonment Plaza, Peshawar',
    incidentTime: '10:45 AM',
    riderName: 'Inamullah Khan',
    riderPhone: '0300-9876543',
    issue: 'Snatching',
    priority: 'High',
    stage: 'In progress',
    amount: 22400,
    recovered: 0,
    cls: '',
    officer: 'Naveed Afridi',
    date: '2026-10-28',
    accepted: false,
    fsoAcknowledged: false,
    description: 'Rider reported bike intercept and cash collection pouch snatched. Dispatched to Naveed Afridi, awaiting officer acknowledgment.',
  },

  // Rawalpindi Cases
  {
    id: 'POS-RAW-OCT-26-2',
    co: 'PostEx',
    hub: 'PostEx Rawalpindi Satellite Town Hub',
    city: 'Rawalpindi',
    exactLocation: 'Murree Road, Rehmanabad Metro Station, Rawalpindi',
    incidentTime: '11:00 AM',
    riderName: 'Shahid Abbasi',
    riderPhone: '0333-1122445',
    issue: 'Assault',
    priority: 'High',
    stage: 'In progress',
    amount: 15300,
    recovered: 0,
    cls: '',
    officer: 'Usman Tariq',
    date: '2026-10-28',
    accepted: false,
    fsoAcknowledged: false,
    description: 'Rider physical altercation during delivery attempt. Assigned to Usman Tariq awaiting confirmation.',
  },
  {
    id: 'POS-ISL-OCT-26-2',
    co: 'PostEx',
    hub: 'PostEx Islamabad I-9 Hub',
    city: 'Islamabad',
    exactLocation: 'Blue Area, Fazl-e-Haq Road, Islamabad',
    incidentTime: '03:15 PM',
    riderName: 'Asim Riaz',
    riderPhone: '0322-3344556',
    issue: 'Snatching',
    priority: 'High',
    stage: 'Closed',
    amount: 7000,
    recovered: 5200,
    cls: 'Fraud',
    officer: 'Sara Ahmed',
    date: '2026-10-28',
    description: 'Disputed cash reconciliation resolved with client. Amount recovered.',
  },
];

// Message Type supporting Live Location
export type Msg = {
  user: string;
  role: string;
  text: string;
  time: string;
  type?: 'text' | 'file' | 'location';
  location?: {
    lat: number;
    lng: number;
    address: string;
    accuracy?: string;
  };
};

function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('CRO');
  const [sfsoCity, setSfsoCity] = useState<'Islamabad' | 'Lahore' | 'Karachi'>('Islamabad'); // 3 SFSOs
  const [co, setCo] = useState('PostEx');
  const [signed, setSigned] = useState(false);
  const [page, setPage] = useState('Today');
  const [cases, setCases] = useState<C[]>(() => initial.map((item, index) => ({
    ...item,
    followUps: index < 3 ? [
      {
        text: `Incident Follow-Up & Contact Report:\nContacted the ${item.hub} team regarding ${item.issue.toLowerCase()}. The rider's statement has been recorded and the reported location verified. Disputed amount is PKR ${item.amount.toLocaleString()}. Branch records are being collected for reconciliation.`,
        author: 'Shoaib (CRO)',
        at: '2026-10-28T09:30:00+05:00',
      },
      {
        text: `Follow-Up Update:\nBranch supervisor shared shipment delivery register for audit. Verification in progress.`,
        author: 'Shoaib (CRO)',
        at: '2026-10-29T10:15:00+05:00',
      },
    ] : [],
    findings: item.stage === 'Closed' ? [
      {
        text: 'Final Investigation Finding & Closure Report:\nDisputed COD reconciliation confirmed with hub operations. Parcel audit verified and recovered PKR 5,200. Client accounts team notified and resolution certified.',
        author: 'Shoaib (CRO)',
        at: '2026-10-28T16:00:00+05:00',
        files: [{ name: 'Reconciliation_Statement.pdf', url: '#' }],
      }
    ] : [],
  })));
  const [activeFsoName, setActiveFsoName] = useState('Sara Ahmed'); // For FSO view switcher
  const [fsoViewMode, setFsoViewMode] = useState<'assigned' | 'city'>('assigned');
  const [logs, setLogs] = useState<{ user: string; action: string; id: string; time: string }[]>([]);
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>({
    'cPOS-RAW-OCT-26-1': [
      { user: 'PostEx user', role: 'Client', text: 'Rider reported payment not credited from commercial market hub.', time: '09:27', type: 'text' },
      { user: 'Mohafiz Operations', role: 'CRO', text: 'Case logged. Reviewing with accounts desk.', time: '09:31', type: 'text' },
    ],
    'iPOS-LAH-OCT-26-1': [
      { user: 'Zubair Shah', role: 'FSO', text: 'Reached Mall Road scene. Interviewing eyewitnesses.', time: '10:12', type: 'text' },
      {
        user: 'Zubair Shah',
        role: 'FSO',
        text: '📍 Live Location Broadcast Started',
        time: '10:13',
        type: 'location',
        location: {
          lat: 31.5546,
          lng: 74.3218,
          address: 'Mall Road, near Charing Cross, Lahore',
          accuracy: '±3m (High-Precision GPS)',
        },
      },
      { user: 'Hamza (SFSO)', role: 'SFSO', text: 'Noted Zubair. Keep us posted on FIR registration.', time: '10:15', type: 'text' },
    ],
  });
  const [selected, setSelected] = useState(initial[0].id);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState('');
  const [findingsCaseId, setFindingsCaseId] = useState('');
  const [findingsDraft, setFindingsDraft] = useState('');
  const [findingFiles, setFindingFiles] = useState<File[]>([]);
  const [clientKpiFilter, setClientKpiFilter] = useState<'all' | 'open' | 'waiting' | 'closed'>('all');
  const [reportModalCase, setReportModalCase] = useState<C | null>(null);
  const [intake, setIntake] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem('desk-theme') !== 'dark';
    } catch {
      return true;
    }
  });
  const [f, setF] = useState<Record<string, string>>({});

  // Modal State for Viewing Exact Location / Map
  const [viewLocCase, setViewLocCase] = useState<C | null>(null);
  const [viewLiveLocModal, setViewLiveLocModal] = useState<Msg['location'] | null>(null);
  const [busyModalCase, setBusyModalCase] = useState<C | null>(null);
  const [busyReasonText, setBusyReasonText] = useState('');
  const [kpiFilter, setKpiFilter] = useState<'All' | 'Busy' | 'Free'>('All');

  // Active SFSO Info
  const activeSfso = sfsoDesks[sfsoCity];

  // Active FSO Info & City
  const activeOfficer = officers.find(o => o.name === activeFsoName) || officers[0];
  const fsoCity = activeOfficer.city;

  const name =
    role === 'CRO'
      ? 'Shoaib'
      : role === 'SFSO'
      ? `${activeSfso.name} (${sfsoCity})`
      : role === 'FSO'
      ? activeFsoName
      : co + ' user';

  // Cases occurring in the active FSO's city
  const fsoCityCases = cases.filter(c =>
    sfsoCityMatches(c.city, fsoCity === 'Rawalpindi' ? 'Islamabad' : fsoCity)
  );

  // FSO Acknowledges an assigned case
  const handleFsoAcknowledge = (caseItem: C) => {
    patch(
      caseItem,
      {
        fsoAcknowledged: true,
        accepted: true,
        stage: 'In progress',
        fsoAcknowledgedAt: time(),
      },
      `Field Officer ${name} acknowledged Case #${caseItem.id}`
    );

    // Auto message dispatched EXCLUSIVELY to Internal Case Group
    const internalMsg: Msg = {
      user: `${name} (FSO)`,
      role: 'FSO',
      text: `✅ Field Officer ${name} has acknowledged Case #${caseItem.id} and confirmed on-ground response in ${caseItem.city}. Priority: ${caseItem.priority}. Location: ${caseItem.exactLocation || caseItem.city}.`,
      time: time(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      ['i' + caseItem.id]: [...(all['i' + caseItem.id] || []), internalMsg],
    }));

    setNotice(`Case #${caseItem.id} acknowledged by ${name}. Confirmation message sent to internal group.`);
  };

  const time = () =>
    new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const log = (action: string, id = '—') =>
    setLogs(v => [{ user: name + ' • ' + role, action, id, time: time() }, ...v]);

  const go = (p: string) => {
    setPage(p);
    setDetail('');
    setIntake(false);
    setNotice('');
    setText('');
    setF({});
    setMobileNavOpen(false);
    log('Opened ' + p);
  };

  // Filter cases visible to current user:
  // - Client: sees only their company's cases
  // - FSO: sees only cases assigned to them
  // - SFSO: sees ONLY their city cases (Islamabad SFSO -> Islamabad/Rawalpindi; Lahore SFSO -> Lahore; Karachi SFSO -> Karachi)
  // - CRO: sees all cases
  const visible = cases.filter(c => {
    if (role === 'Client') return c.co === co;
    if (role === 'FSO') return c.officer === name;
    if (role === 'SFSO') return sfsoCityMatches(c.city, sfsoCity);
    return true; // CRO sees all
  });

  // FSOs visible to the user:
  // SFSO only sees FSOs in their city!
  const visibleFSOs = officers.filter(o =>
    role === 'SFSO' ? sfsoCityMatches(o.city, sfsoCity) : true
  );

  const filtered = visible.filter(c =>
    Object.entries(f).every(
      ([k, v]) =>
        !v ||
        v === 'All' ||
        (k === 'from'
          ? c.date >= v
          : k === 'to'
          ? c.date <= v
          : k === 'search'
          ? c.id.toLowerCase().includes(v.toLowerCase())
          : String(c[k as keyof C]) === v)
    )
  );

  const patch = (c: C, v: Partial<C>, action: string) => {
    const current = cases.find(item => item.id === c.id) || c;
    if (v.stage === 'Closed' && !current.findings?.some(finding => finding.text.trim())) {
      setNotice('Add and save case findings before closing this case.');
      return;
    }
    if (v.report) {
      const key = 'i' + c.id;
      setMsgs(all => ({
        ...all,
        [key]: [
          ...(all[key] || []),
          { user: name, role, text: 'Field report: ' + v.report, time: time(), type: 'text' },
        ],
      }));
    }
    setCases(all => all.map(x => (x.id === c.id ? { ...x, ...v } : x)));
    log(action, c.id);
    setNotice(action + '.');
  };

  // Exact Case ID generation formula from Excel / Google Sheets:
  // =IF(AND(ISBLANK(F27), ISBLANK(G27), ISBLANK(C27), ISBLANK(D27)), "", 
  //  UPPER(CONCATENATE(LEFT(F27, 3), "-", LEFT(G27, 3), "-", LEFT(C27, 3), "-", RIGHT(D27, 2), "-")) 
  //  & COUNTIFS(C$2:C27, C27, D$2:D27, D27, F$2:F27, F27, G$2:G27, G27))
  // Format: [CLIENT_3]-[CITY_3]-[MONTH_3]-[YEAR_2]-[COUNTER]
  const generateNextCaseId = (company: string, city: string, incidentDate = new Date()) => {
    const clientCode = (company || 'POS').trim().slice(0, 3).toUpperCase();
    const cityCode = (city || 'RAW').trim().slice(0, 3).toUpperCase();
    const monthCode = incidentDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const yearCode = String(incidentDate.getFullYear()).slice(-2);
    const prefix = `${clientCode}-${cityCode}-${monthCode}-${yearCode}-`;

    const matchingCases = cases.filter(c => c.id.startsWith(prefix));
    const numbers = matchingCases
      .map(c => {
        const suffix = c.id.slice(prefix.length);
        const num = parseInt(suffix, 10);
        return isNaN(num) ? 0 : num;
      })
      .filter(n => !isNaN(n) && n > 0);

    const nextCount = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${nextCount}`;
  };

  // CRO Acknowledges Case and sends it to SFSO
  const acknowledgeCaseToSfso = (c: C) => {
    const clientKey = 'c' + c.id;
    const targetSfsoDesk =
      c.city === 'Karachi'
        ? 'SFSO Karachi Desk'
        : c.city === 'Lahore'
        ? 'SFSO Lahore Desk'
        : 'SFSO Islamabad Desk';

    const autoAckMsg: Msg = {
      user: 'Mohafiz Operations',
      role: 'CRO',
      text: `📢 Case #${c.id} has been acknowledged by Mohafiz Operations Desk and officially forwarded to ${targetSfsoDesk} for on-ground team assignment. Hub: ${c.hub || c.co}. Exact Location: ${c.exactLocation}.`,
      time: time(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      [clientKey]: [...(all[clientKey] || []), autoAckMsg],
    }));

    setSelected(c.id);

    setCases(all =>
      all.map(x =>
        x.id === c.id
          ? {
              ...x,
              stage: 'Escalated',
              acknowledgedAt: time(),
              acknowledgedBy: 'Mohafiz Operations',
            }
          : x
      )
    );

    log('Acknowledged and sent to ' + targetSfsoDesk, c.id);
    setNotice(
      `Case ${c.id} acknowledged! Official Case ID auto-sent to Client Updates chat and dispatched to ${targetSfsoDesk}.`
    );
  };

  // Helper to calculate FSO availability & workload
  const getFsoWorkload = (officerName: string) => {
    const officerCases = cases.filter(c => c.officer === officerName);
    const activeCases = officerCases.filter(c => c.stage === 'In progress' && !c.isQueued);
    const queuedCases = officerCases.filter(c => c.isQueued && c.stage !== 'Closed');
    const onHoldCases = officerCases.filter(c => c.stage === 'Hold');
    const closedCases = officerCases.filter(c => c.stage === 'Closed');

    const isBusy = activeCases.length > 0;
    const currentCase = activeCases[0] || null;

    return {
      officer: officerName,
      status: (isBusy ? 'Busy' : 'Free') as 'Busy' | 'Free',
      isBusy,
      activeCount: activeCases.length,
      queuedCount: queuedCases.length,
      onHoldCount: onHoldCases.length,
      closedCount: closedCases.length,
      totalCount: officerCases.filter(c => c.stage !== 'Closed').length,
      currentCase,
      queuedCases,
    };
  };

  // Only compute workloads for the FSOs visible to the active SFSO
  const currentFsoWorkloads = visibleFSOs.map(o => ({
    ...o,
    ...getFsoWorkload(o.name),
  }));

  const freeFsoCount = currentFsoWorkloads.filter(w => w.status === 'Free').length;
  const busyFsoCount = currentFsoWorkloads.filter(w => w.status === 'Busy').length;

  const filteredWorkloads =
    kpiFilter === 'Busy'
      ? currentFsoWorkloads.filter(w => w.status === 'Busy')
      : kpiFilter === 'Free'
      ? currentFsoWorkloads.filter(w => w.status === 'Free')
      : currentFsoWorkloads;

  // FSO Reports Busy / Unable to proceed with an assigned case
  const handleFsoReportBusy = (caseItem: C, reason: string) => {
    if (!reason.trim()) return;

    patch(
      caseItem,
      {
        stage: 'Escalated',
        officer: '',
        isQueued: false,
        accepted: false,
        busyReason: reason.trim(),
        busyByOfficer: name,
        busyReportedAt: time(),
      },
      `Reported unable to proceed by ${name}: escalated back to SFSO for reassignment`
    );

    const internalMsg: Msg = {
      user: `${name} (FSO)`,
      role: 'FSO',
      text: `⚠️ Field Officer ${name} reported unable to proceed with Case #${caseItem.id}: "${reason.trim()}". Case escalated back to SFSO for reassignment to another officer.`,
      time: time(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      ['i' + caseItem.id]: [...(all['i' + caseItem.id] || []), internalMsg],
    }));

    setBusyModalCase(null);
    setBusyReasonText('');
    setNotice(`Case #${caseItem.id} marked as unable to proceed and escalated to SFSO for reassignment.`);
  };

  // SFSO Assigns Case to Officer (Initial or Reassignment)
  const assignCaseBySfso = (caseItem: C, chosenOfficer: string) => {
    const workload = getFsoWorkload(chosenOfficer);
    const internalKey = 'i' + caseItem.id;
    const wasReassigned = Boolean(caseItem.busyReason);
    const reassignedNote = wasReassigned
      ? ` (Reassigned from ${caseItem.busyByOfficer || 'previous officer'} who reported unable to proceed)`
      : '';

    if (workload.isBusy) {
      const newQueueOrder = workload.queuedCount + 1;
      patch(
        caseItem,
        {
          officer: chosenOfficer,
          stage: 'Escalated',
          isQueued: true,
          queueOrder: newQueueOrder,
          fsoAcknowledged: false,
          accepted: false,
          busyReason: undefined,
          busyByOfficer: undefined,
          busyReportedAt: undefined,
        },
        `Queued for ${chosenOfficer} (Next upcoming task #${newQueueOrder})${reassignedNote}`
      );

      const internalMsg: Msg = {
        user: `${name} (SFSO)`,
        role: 'SFSO',
        text: `🚨 Case #${caseItem.id} assigned to Field Officer ${chosenOfficer} by SFSO ${name} (Queued Task #${newQueueOrder})${reassignedNote}. Priority: ${caseItem.priority}. Location: ${caseItem.exactLocation || caseItem.city}.`,
        time: time(),
        type: 'text',
      };

      setMsgs(all => ({
        ...all,
        [internalKey]: [...(all[internalKey] || []), internalMsg],
      }));

      setSelected(caseItem.id);

      setNotice(
        `Assigned ${caseItem.id} to ${chosenOfficer} as upcoming queued case #${newQueueOrder}. They will execute it after finishing their current active case.`
      );
    } else {
      patch(
        caseItem,
        {
          officer: chosenOfficer,
          stage: 'In progress',
          isQueued: false,
          queueOrder: 0,
          fsoAcknowledged: false,
          accepted: false,
          busyReason: undefined,
          busyByOfficer: undefined,
          busyReportedAt: undefined,
        },
        `Assigned to ${chosenOfficer} by SFSO — Awaiting FSO Acknowledgement${reassignedNote}`
      );

      const internalMsg: Msg = {
        user: `${name} (SFSO)`,
        role: 'SFSO',
        text: `🚨 Case #${caseItem.id} assigned to Field Officer ${chosenOfficer} by SFSO ${name} (Immediate Dispatch)${reassignedNote}. Location: ${caseItem.exactLocation || caseItem.city}.`,
        time: time(),
        type: 'text',
      };

      setMsgs(all => ({
        ...all,
        [internalKey]: [...(all[internalKey] || []), internalMsg],
      }));

      setSelected(caseItem.id);

      setNotice(
        `${chosenOfficer} is free. Assigned ${caseItem.id} for immediate field execution.`
      );
    }
  };

  const chip = (s: string) => (
    <span className={'chip ' + s.toLowerCase().replaceAll(' ', '-')}>{s}</span>
  );

  const select = (label: string, values: string[], value: string, change: (v: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={e => change(e.target.value)}>
        {values.map(v => (
          <option key={v} value={v}>
            {v || 'Not classified'}
          </option>
        ))}
      </select>
    </label>
  );

  const filter = (k: string, label: string, values: string[]) =>
    select(label, ['All', ...values], f[k] || 'All', v => setF({ ...f, [k]: v }));

  const current = visible.find(c => c.id === selected) || visible[0];
  const clientChannelName = `Mohafiz X ${role === 'Client' ? co : (visible.find(item => item.id === detail) || current)?.co || co}`;
  const pageLabel = (value: string) => value === 'Client Updates' ? clientChannelName : value;

  // Send message or live location in chat
  const send = (channel: string, file?: File, liveLocation = false) => {
    if (!current) return;
    const key = channel + current.id;

    if (liveLocation) {
      const locMsg: Msg = {
        user: name,
        role,
        text: '📍 Shared Live GPS Location',
        time: time(),
        type: 'location',
        location: {
          lat: current.city === 'Rawalpindi' ? 33.6007 : current.city === 'Karachi' ? 24.8607 : 31.5204,
          lng: current.city === 'Rawalpindi' ? 73.0679 : current.city === 'Karachi' ? 67.0011 : 74.3587,
          address: current.exactLocation || `${current.city} incident zone`,
          accuracy: '±3m (High-Accuracy Real-Time GPS)',
        },
      };
      setMsgs(v => ({ ...v, [key]: [...(v[key] || []), locMsg] }));
      log('Shared live location', current.id);
      setNotice('Live location shared to chat.');
      return;
    }

    if (!text.trim() && !file) return;

    setMsgs(v => ({
      ...v,
      [key]: [
        ...(v[key] || []),
        {
          user: name,
          role,
          text: file ? 'Attachment: ' + file.name : text.trim(),
          time: time(),
          type: file ? 'file' : 'text',
        },
      ],
    }));
    setText('');
    log(channel === 'c' ? 'Client message sent' : 'Internal message sent', current.id);
  };

  const chat = (channel: string) => (
    <>
      <p className="sub">
        {channel === 'c'
          ? 'Shared communication channel between Client, CRO and SFSO.'
          : 'Staff-only operational channel: CRO, SFSO, and assigned Field Security Officers (FSOs).'}
      </p>
      <div className="bar">
        {select('Select Case', visible.map(c => c.id), current?.id || '', setSelected)}
        {chip(channel === 'c' ? 'Shared with client' : 'Internal case group')}
        {current && (
          <button
            type="button"
            className="loc-pill"
            style={{ marginLeft: 'auto' }}
            onClick={() => setViewLocCase(current)}
          >
            <MapPin size={13} />
            <span>Exact: {current.exactLocation || current.city}</span>
          </button>
        )}
      </div>

      {current ? (
        <>
          <div className="messages">
            {(msgs[channel + current.id] || []).map((m, i) => (
              <div className={'message ' + (m.user === name ? 'me' : '')} key={i}>
                <small>
                  {m.role === 'CRO' && (role === 'Client' || channel === 'c')
                    ? 'Mohafiz Operations • Operations Desk'
                    : `${m.user} • ${m.role}`}{' '}
                  • {m.time}
                </small>
                {m.type === 'location' && m.location ? (
                  <div className="chat-live-loc">
                    <div className="chat-live-loc-header">
                      <span className="chat-live-badge">
                        <span className="radar-pulse"></span>
                        Live GPS Broadcast
                      </span>
                      <small style={{ color: '#b7e3ea' }}>Active</small>
                    </div>
                    <div className="chat-live-address">
                      <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {m.location.address}
                    </div>
                    <div className="chat-live-coords">
                      GPS: {m.location.lat.toFixed(4)}° N, {m.location.lng.toFixed(4)}° E
                    </div>
                    <div className="chat-live-meta">
                      <span>{m.location.accuracy}</span>
                      <button
                        type="button"
                        style={{
                          background: '#ffffff22',
                          color: '#fff',
                          border: '1px solid #ffffff44',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => setViewLiveLocModal(m.location!)}
                      >
                        View Full Map
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{m.text}</p>
                )}
              </div>
            ))}
            {!(msgs[channel + current.id] || []).length && (
              <p className="sub">No messages yet. Start the conversation or share real-time updates.</p>
            )}
          </div>

          <form
            className="bar"
            onSubmit={e => {
              e.preventDefault();
              send(channel);
            }}
          >
            <input
              aria-label="Message"
              placeholder="Type a message or operational dispatch update..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button className="primary" type="submit">
              Send <Send size={13} style={{ display: 'inline', marginLeft: 4 }} />
            </button>
          </form>

          <div className="bar" style={{ gap: 8, alignItems: 'center' }}>
            {/* Live Location Share Button - ONLY for FSO (Field Security Officer) */}
            {role === 'FSO' && (
              <button
                type="button"
                className="primary"
                style={{
                  background: '#087f8c',
                  borderColor: '#18a2b2',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                }}
                onClick={() => send(channel, undefined, true)}
                title="Broadcast real-time device location to this case room"
              >
                <Radio size={14} className="radar-pulse" />
                <span>📍 Share Live Location</span>
              </button>
            )}

            {['Document', 'Image', 'Video', 'File'].map(a => (
              <label className="upload" key={a}>
                + {a}
                <input
                  type="file"
                  accept={
                    a === 'Image'
                      ? 'image/*'
                      : a === 'Video'
                      ? 'video/*'
                      : a === 'Document'
                      ? '.pdf,.doc,.docx,.txt'
                      : undefined
                  }
                  onChange={e => {
                    if (e.target.files?.[0]) send(channel, e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            ))}
          </div>
          <small>Demo GPS coordinates and attachments are simulated for the Mohafiz prototype.</small>
        </>
      ) : (
        <div className="empty">No assigned cases available.</div>
      )}
    </>
  );

  const exportCsv = () => {
    const rows = [
      [
        'Case ID',
        'Company',
        'Client Hub',
        'Date Reported',
        'Incident Time',
        'Issue Type',
        'Exact Location',
        'Rider Name',
        'Rider Phone',
        'Classification',
        'Total Amount',
        'Recovered',
        'City',
        'Status',
        'Assigned FSO',
      ],
      ...filtered.map(c => [
        c.id,
        c.co,
        c.hub || '',
        c.date,
        c.incidentTime || '',
        c.issue,
        c.exactLocation || '',
        c.riderName || '',
        c.riderPhone || '',
        c.cls,
        c.amount,
        c.recovered,
        c.city,
        c.stage,
        c.officer,
      ]),
    ];
    const csv = rows
      .map(row =>
        row
          .map(v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"')
          .join(',')
      )
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mohafiz-cases.csv';
    a.click();
    URL.revokeObjectURL(url);
    log('Exported report');
    setNotice('Exported ' + filtered.length + ' cases.');
  };

  // Client / CRO Case Intake Form
  const [formCompany, setFormCompany] = useState(role === 'Client' ? co : 'PostEx');
  const availableHubs = clientHubs[formCompany] || clientHubs['PostEx'];

  const intakeForm = (
    <form
      className="box intake"
      onSubmit={e => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const company = role === 'Client' ? co : String(d.get('co'));
        const city = String(d.get('city'));
        const id = generateNextCaseId(company, city);

        const hubVal = String(d.get('hub'));
        const customHub = String(d.get('customHub') || '').trim();
        const finalHub = customHub ? customHub : hubVal;

        const exactLocation = String(d.get('exactLocation')).trim();
        const incidentTime = String(d.get('incidentTime')).trim();
        const riderName = String(d.get('riderName')).trim();
        const riderPhone = String(d.get('riderPhone')).trim();
        const issue = String(d.get('issue'));
        const priority = String(d.get('priority'));
        const amount = Number(d.get('amount'));
        const description = String(d.get('description')).trim();

        const newCase: C = {
          id,
          co: company,
          hub: finalHub,
          city,
          exactLocation,
          incidentTime: incidentTime || '12:00 PM',
          riderName: riderName || 'Rider Not Specified',
          riderPhone: riderPhone || 'N/A',
          issue,
          priority,
          amount,
          recovered: 0,
          stage: 'New',
          cls: '',
          officer: '',
          date: '2026-10-28',
          description,
          source: role === 'CRO' ? String(d.get('source')) : 'Client Portal',
        };

        setSelected(id);
        setCases(v => [newCase, ...v]);
        log('Raised a case', id);
        go(role === 'Client' ? 'My Cases' : 'New Cases');
        setNotice(
          `Case raised successfully! Generated Case ID: ${id}. Sent to CRO for acknowledgement.`
        );
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
        <h2>{role === 'Client' ? `Raise a Case — ${co}` : 'Log a Case (CRO Intake)'}</h2>
        <span className="chip new">All fields compulsory *</span>
      </div>

      {role === 'CRO' && (
        <label>
          Client Company <span className="req">*</span>
          <select
            name="co"
            required
            value={formCompany}
            onChange={e => setFormCompany(e.target.value)}
          >
            {companies.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Row 1: Issue & Priority */}
      <div className="grid">
        <label>
          Issue Type <span className="req">*</span>
          <select name="issue" required defaultValue="">
            <option value="" disabled>
              Select issue type (Required)
            </option>
            <option>Payment dispute</option>
            <option>Rider Snatching / Robbery</option>
            <option>Theft</option>
            <option>Fake Delivery</option>
            <option>Verification issue</option>
            <option>Customer Issue</option>
            <option>Service complaint</option>
            <option>Cash Discrepancy</option>
            <option>Tampered Parcel</option>
          </select>
        </label>

        <label>
          Priority <span className="req">*</span>
          <select name="priority" required defaultValue="Medium">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
      </div>

      {/* Row 2: Client Hub & City */}
      <div className="grid">
        <label>
          Who Raised Case (Client Hub / Branch) <span className="req">*</span>
          <select name="hub" required defaultValue={availableHubs[0]}>
            {availableHubs.map(h => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
            <option value="Other Hub">Other Hub / Custom Branch</option>
          </select>
        </label>

        <label>
          City <span className="req">*</span>
          <select name="city" required defaultValue="Rawalpindi">
            {cities.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3: Exact Location (Required by client) */}
      <label>
        Exact Location (Client-Reported Location / Landmark) <span className="req">*</span>
        <input
          name="exactLocation"
          required
          minLength={5}
          placeholder="e.g. Shop #4, Commercial Market, Opposite Tehzeeb Bakers, Satellite Town, Rawalpindi"
        />
      </label>

      {/* Row 4: Rider Details & Incident Time */}
      <div className="grid">
        <label>
          Rider Name <span className="req">*</span>
          <input name="riderName" required minLength={2} placeholder="e.g. Muhammad Zeeshan" />
        </label>

        <label>
          Rider Contact Number <span className="req">*</span>
          <input
            name="riderPhone"
            required
            placeholder="e.g. 0300-1234567"
            pattern="^03[0-9]{2}-?[0-9]{7}$"
            title="Please enter a valid Pakistani mobile number (e.g. 0300-1234567)"
          />
        </label>
      </div>

      <div className="grid">
        <label>
          Incident Time <span className="req">*</span>
          <input
            name="incidentTime"
            type="text"
            required
            placeholder="e.g. 14:30 or 02:30 PM"
            defaultValue="14:30"
          />
        </label>

        <label>
          Amount Involved (PKR) <span className="req">*</span>
          <input name="amount" type="number" min="1" required placeholder="e.g. 25000" defaultValue="15000" />
        </label>
      </div>

      {role === 'CRO' && (
        <label>
          Intake Channel <span className="req">*</span>
          <select name="source" required defaultValue="Phone">
            <option>Phone Hotline</option>
            <option>Email Escalation</option>
            <option>Client Portal API</option>
            <option>Hub Walk-in</option>
          </select>
        </label>
      )}

      <label>
        What Happened (Incident Description) <span className="req">*</span>
        <textarea
          name="description"
          minLength={20}
          required
          rows={4}
          placeholder="Describe the incident in detail (at least 20 characters) including witnesses, circumstances and immediate risk."
        />
      </label>

      <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
        <button className="primary" type="submit">
          Submit & Generate Case ID
        </button>
        <button type="button" onClick={() => (role === 'Client' ? go('My Cases') : setIntake(false))}>
          Cancel
        </button>
      </div>
    </form>
  );

  const c = visible.find(c => c.id === detail);

  // Close Case Directly Helper (for CRO)
  const closeCaseDirectly = (caseToClose: C) => {
    patch(
      caseToClose,
      {
        stage: 'Closed',
        cls: caseToClose.cls || 'Genuine',
        recovered: caseToClose.recovered || caseToClose.amount,
      },
      'Case closed directly by CRO'
    );
  };

  // Mark Case In Progress Helper (for CRO)
  const markCaseInProgress = (caseToMove: C) => {
    patch(
      caseToMove,
      {
        stage: 'In progress',
      },
      'Marked as In Progress by CRO'
    );
  };

  return (
    <div className={'desk ' + (light ? 'light' : '')}>
      {/* Exact Location & Map Preview Modal */}
      {viewLocCase && (
        <div className="modal-overlay" onClick={() => setViewLocCase(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color="#087f8c" />
                <h3>Exact Incident Location</h3>
              </div>
              <button className="modal-close" onClick={() => setViewLocCase(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Case Reference: {viewLocCase.id}</b>
                {chip(viewLocCase.priority)}
              </div>
              <span className="hub-tag">Raised by: {viewLocCase.hub || viewLocCase.co}</span>
            </div>

            <div
              style={{
                background: 'var(--soft)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                CLIENT REPORTED EXACT LOCATION:
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                📍 {viewLocCase.exactLocation || 'Location address not specified'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                City: <b>{viewLocCase.city}</b> • Time: <b>{viewLocCase.incidentTime || 'Not recorded'}</b>
              </div>
            </div>

            <div className="grid" style={{ marginBottom: 16 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: 12, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>RIDER ON DUTY</div>
                <b style={{ fontSize: 13 }}>{viewLocCase.riderName || 'N/A'}</b>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                  <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {viewLocCase.riderPhone || 'N/A'}
                </div>
              </div>

              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: 12, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>ASSIGNED OFFICER</div>
                <b style={{ fontSize: 13 }}>{viewLocCase.officer || 'Unassigned / Pending SFSO'}</b>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Status: <b>{viewLocCase.stage}</b>
                </div>
              </div>
            </div>

            {/* Simulated Interactive Map Pin */}
            <div
              style={{
                height: 160,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #132238, #1e3557)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.25,
                  backgroundImage:
                    'radial-gradient(#6ed4de 1px, transparent 1px), radial-gradient(#6ed4de 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  backgroundPosition: '0 0, 12px 12px',
                }}
              />
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ display: 'inline-block', position: 'relative' }}>
                  <MapPin size={34} color="#f43f5e" />
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                </div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 12, marginTop: 4 }}>
                  {viewLocCase.city} Geo-Grid Verified
                </div>
                <small style={{ color: '#a5d8f3' }}>
                  {viewLocCase.city === 'Rawalpindi'
                    ? '33.6007° N, 73.0679° E'
                    : viewLocCase.city === 'Karachi'
                    ? '24.8607° N, 67.0011° E'
                    : '31.5204° N, 74.3587° E'}
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="primary" onClick={() => setViewLocCase(null)}>
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live GPS Broadcast Modal */}
      {viewLiveLocModal && (
        <div className="modal-overlay" onClick={() => setViewLiveLocModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={20} color="#00f0ff" />
                <h3>Live Officer GPS Broadcast</h3>
              </div>
              <button className="modal-close" onClick={() => setViewLiveLocModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="chat-live-loc" style={{ maxWidth: '100%', margin: 0, marginBottom: 15 }}>
              <div className="chat-live-loc-header">
                <span className="chat-live-badge">
                  <span className="radar-pulse"></span>
                  Active Real-time GPS Beacon
                </span>
                <span style={{ fontSize: 11, color: '#a5f3fc' }}>Tracking Live</span>
              </div>
              <div className="chat-live-address" style={{ fontSize: 14 }}>
                {viewLiveLocModal.address}
              </div>
              <div className="chat-live-coords" style={{ fontSize: 13 }}>
                Coordinates: {viewLiveLocModal.lat.toFixed(5)}° N, {viewLiveLocModal.lng.toFixed(5)}° E
              </div>
              <div className="chat-live-meta">
                <span>Precision: {viewLiveLocModal.accuracy}</span>
                <span>Signal: Excellent (5G/GNSS)</span>
              </div>
            </div>
            <button className="primary full" onClick={() => setViewLiveLocModal(null)}>
              Dismiss Live Map
            </button>
          </div>
        </div>
      )}

      {/* FSO Report Busy / Unable to Proceed Modal */}
      {busyModalCase && (
        <div className="modal-overlay" onClick={() => setBusyModalCase(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#f59e0b" />
                <h3>Report Unable to Proceed</h3>
              </div>
              <button className="modal-close" onClick={() => setBusyModalCase(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '6px 0 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                Case: <b>{busyModalCase.id}</b> • {busyModalCase.issue}
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Explain why you are currently busy or working elsewhere and cannot take this dispatch. Your note will be recorded and the case will be escalated back to SFSO for immediate reassignment.
              </p>
              <label>
                Reason Description <span className="req">*</span>
                <textarea
                  required
                  rows={4}
                  minLength={10}
                  value={busyReasonText}
                  onChange={e => setBusyReasonText(e.target.value)}
                  placeholder="e.g. Currently engaged in critical statement recording at another incident location, unable to reach venue..."
                  style={{ width: '100%', marginTop: 5, fontSize: 12, resize: 'vertical' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="primary"
                style={{ background: '#b91c1c', borderColor: '#b91c1c', flex: 1 }}
                disabled={busyReasonText.trim().length < 5}
                onClick={() => handleFsoReportBusy(busyModalCase, busyReasonText)}
              >
                Submit & Send to SFSO
              </button>
              <button type="button" onClick={() => setBusyModalCase(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Incident Resolution & Case Findings Report Modal */}
      {reportModalCase && (
        <div className="modal-overlay" onClick={() => setReportModalCase(null)}>
          <div className="report-modal-card" onClick={e => e.stopPropagation()}>
            <div className="report-doc-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="brand-mark" style={{ width: 28, height: 28, padding: 4 }}>
                    <ShieldCheck size={20} color="#fff" />
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.5px' }}>
                    MOHAFIZ SECURITY OPERATIONS
                  </span>
                </div>
                <h2 style={{ margin: '4px 0 2px', fontSize: 16, color: 'var(--text)' }}>
                  Official Incident Investigation & Closure Report
                </h2>
                <small style={{ color: 'var(--muted)' }}>
                  Certified Resolution Document • Case Reference #{reportModalCase.id}
                </small>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="primary"
                    style={{ fontSize: 11, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => window.print()}
                    title="Print document or save as PDF"
                  >
                    <Printer size={13} />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setReportModalCase(null)}
                    aria-label="Close report"
                  >
                    <X size={18} />
                  </button>
                </div>
                <span className="report-seal-badge">
                  <CheckCircle2 size={12} />
                  {reportModalCase.stage === 'Closed' ? 'Official Case Closed' : 'Investigation Report'}
                </span>
              </div>
            </div>

            {/* Case Details Summary Grid */}
            <div className="report-grid">
              <div>
                <div className="report-field-label">Case Identifier</div>
                <div className="report-field-value">{reportModalCase.id}</div>
              </div>
              <div>
                <div className="report-field-label">Client Company & Hub</div>
                <div className="report-field-value">{reportModalCase.co} • {reportModalCase.hub || 'Central Hub'}</div>
              </div>
              <div>
                <div className="report-field-label">Incident Type & Date</div>
                <div className="report-field-value">{reportModalCase.issue} • {reportModalCase.date} ({reportModalCase.incidentTime || '12:00 PM'})</div>
              </div>
              <div>
                <div className="report-field-label">Incident City & Location</div>
                <div className="report-field-value">📍 {reportModalCase.city} • {reportModalCase.exactLocation || 'Location on file'}</div>
              </div>
              <div>
                <div className="report-field-label">Rider on Duty</div>
                <div className="report-field-value">{reportModalCase.riderName} ({reportModalCase.riderPhone || 'No Phone'})</div>
              </div>
              <div>
                <div className="report-field-label">Assigned Field Officer</div>
                <div className="report-field-value">{reportModalCase.officer || 'Operations Team'}</div>
              </div>
              <div>
                <div className="report-field-label">Financial Claim & Recovery</div>
                <div className="report-field-value">Exposure: PKR {reportModalCase.amount.toLocaleString()} • Recovered: PKR {reportModalCase.recovered.toLocaleString()}</div>
              </div>
              <div>
                <div className="report-field-label">Final Classification</div>
                <div className="report-field-value">{reportModalCase.cls || 'Genuine'}</div>
              </div>
            </div>

            {/* Initial Incident Narrative */}
            <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--soft)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div className="report-field-label" style={{ marginBottom: 4 }}>CLIENT REPORTED INCIDENT DESCRIPTION:</div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                {reportModalCase.description || 'No initial incident statement supplied.'}
              </p>
            </div>

            {/* Follow-Up History (Visible to CRO / Operations Desk, excluded for Client) */}
            {role !== 'Client' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#087f8c" />
                    <span>Follow-Up & Contact History (Internal Desk Records)</span>
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    Internal operations log • Excluded from client report
                  </small>
                </div>

                {reportModalCase.followUps && reportModalCase.followUps.length > 0 ? (
                  reportModalCase.followUps.map((fu, i) => (
                    <div
                      key={i}
                      className="report-finding-card"
                      style={{ borderLeftColor: '#d97706' }}
                    >
                      <div className="report-finding-header">
                        <b style={{ fontSize: 13 }}>{fu.author || 'Operations Desk'}</b>
                        <small style={{ color: 'var(--muted)' }}>
                          {new Date(fu.at).toLocaleString()}
                        </small>
                      </div>
                      <div className="report-finding-text">
                        {fu.text}
                      </div>
                      {fu.attachments && fu.attachments.length > 0 && (
                        <div className="report-files-wrap">
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Paperclip size={12} />
                            Follow-Up Attachments:
                          </span>
                          {fu.attachments.map((file, fi) => (
                            <a
                              key={fi}
                              href={file.url}
                              download={file.name}
                              className="hub-tag"
                              style={{ textDecoration: 'none', background: 'var(--soft)', color: 'var(--accent)', fontWeight: 600 }}
                            >
                              📎 {file.kind ? `${file.kind}: ` : ''}{file.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty" style={{ padding: 12, fontSize: 12 }}>
                    No follow-up entries logged for this case.
                  </div>
                )}
              </div>
            )}

            {/* Official Case Findings Section (Saved by CRO before closing) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color="#087f8c" />
                  <span>Official Investigation Findings & Resolution</span>
                </h3>
                <small style={{ color: 'var(--muted)' }}>
                  Recorded by Operations Desk prior to case closure
                </small>
              </div>

              {reportModalCase.findings && reportModalCase.findings.length > 0 ? (
                reportModalCase.findings.map((f, i) => (
                  <div key={i} className="report-finding-card">
                    <div className="report-finding-header">
                      <b style={{ fontSize: 13 }}>
                        {role === 'Client' ? 'CRO' : (f.author || 'Chief Response Officer (CRO)')}
                      </b>
                      <small style={{ color: 'var(--muted)' }}>
                        {new Date(f.at).toLocaleString()}
                      </small>
                    </div>
                    <div className="report-finding-text">
                      {f.text}
                    </div>
                    {f.files && f.files.length > 0 && (
                      <div className="report-files-wrap">
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Paperclip size={12} />
                          Attached Evidence / Documents:
                        </span>
                        {f.files.map((file, fi) => (
                          <a
                            key={fi}
                            href={file.url}
                            download={file.name}
                            className="hub-tag"
                            style={{ textDecoration: 'none', background: 'var(--soft)', color: 'var(--accent)', fontWeight: 600 }}
                          >
                            📎 {file.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: 18, fontSize: 12 }}>
                  No official findings have been logged for this case yet.
                </div>
              )}
            </div>

            {/* Report Sign-off & Authority Stamp */}
            <div className="report-signature-block">
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Mohafiz Operations Command</div>
                <small style={{ color: 'var(--muted)' }}>Verified & Digitally Certified by CRO Desk</small>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Date of Report: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Case Status:</div>
                <b style={{ fontSize: 14, color: reportModalCase.stage === 'Closed' ? '#10b981' : '#f59e0b' }}>
                  {reportModalCase.stage === 'Closed' ? '✓ CLOSED & RESOLVED' : reportModalCase.stage.toUpperCase()}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}

      {!signed ? (
        <div className="login-page">
          <div className="login-layout">
            <section className="login-hero" aria-label="Incident Management System">
              <div className="login-hero-brand">
                <span className="ims-mark">IMS</span>
                <span>Secure incident workflow portal</span>
              </div>
              <div className="login-hero-copy">
                <h1>Incident Management System</h1>
                <div className="login-features">
                  {['Intake & Auto-ID', '3 City SFSO Desks', 'Live GPS Tracking', 'Incident Resolution'].map(
                    feature => (
                      <span key={feature}>{feature}</span>
                    )
                  )}
                </div>
                <p>Regional Desks: Islamabad • Lahore • Karachi</p>
              </div>
            </section>

            <section className="login-card">
              <div className="login-card-heading">
                <span className="login-mini-mark">IMS</span>
                <div>
                  <p>Secure access</p>
                  <h2>Sign in</h2>
                </div>
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setSigned(true);
                  setShowPassword(false);
                  setPage(nav[role][0]);
                  log('Signed in as ' + name);
                }}
              >
                <label>
                  Email
                  <input type="email" autoComplete="username" placeholder="you@company.com" required defaultValue="officer@mohafiz.pk" />
                </label>
                <div className="password-field">
                  <label htmlFor="login-password">Password</label>
                  <div className="password-input">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      defaultValue="demo"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      aria-controls="login-password"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {select(
                  'Demo: sign in as',
                  [
                    'CRO',
                    'SFSO Islamabad (Ahmed)',
                    'SFSO Lahore (Hamza)',
                    'SFSO Karachi (Tariq)',
                    'FSO Islamabad (Sara Ahmed)',
                    'FSO Rawalpindi (Usman Tariq)',
                    'FSO Lahore (Zubair Shah)',
                    'FSO Lahore (Bilal Hassan)',
                    'FSO Karachi (Ali Raza)',
                    'FSO Karachi (Farhan Qureshi)',
                    'FSO Peshawar (Naveed Afridi)',
                    ...companies.map(company => 'Client ' + company),
                  ],
                  role === 'Client'
                    ? 'Client ' + co
                    : role === 'SFSO'
                    ? `SFSO ${sfsoCity} (${sfsoDesks[sfsoCity].name})`
                    : role === 'FSO'
                    ? `FSO ${fsoCity} (${activeFsoName})`
                    : role,
                  value => {
                    if (value.startsWith('Client ')) {
                      setRole('Client');
                      setCo(value.slice(7));
                    } else if (value.startsWith('SFSO ')) {
                      setRole('SFSO');
                      if (value.includes('Lahore')) setSfsoCity('Lahore');
                      else if (value.includes('Karachi')) setSfsoCity('Karachi');
                      else setSfsoCity('Islamabad');
                    } else if (value.startsWith('FSO ')) {
                      setRole('FSO');
                      const match = officers.find(o => value.includes(o.name));
                      if (match) {
                        setActiveFsoName(match.name);
                      }
                    } else {
                      setRole(value);
                    }
                  }
                )}
                <button className="primary full">Sign in →</button>
                <button
                  className="link"
                  type="button"
                  onClick={() =>
                    setNotice('Password reset is simulated. Contact your administrator for account access.')
                  }
                >
                  Forgot password?
                </button>
              </form>
              <small className="login-demo">Demo: choose any role to inspect city isolation.</small>
              {notice && (
                <p className="login-status" role="status">
                  {notice}
                </p>
              )}
            </section>
          </div>
          <footer className="login-footer">
            <span>IMS (Incident Management System) • Mohafiz Case Desk</span>
            <span>Secure. Track. Resolve.</span>
          </footer>
        </div>
      ) : (
        <>
          {/* Mobile Backdrop Scrim */}
          {mobileNavOpen && (
            <div
              className="mobile-backdrop"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close mobile navigation"
            />
          )}

          <aside className={mobileNavOpen ? 'mobile-open' : ''}>
            <div className="mobile-drawer-header">
              <Brand />
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <p className="workspace">
              {role === 'Client'
                ? co
                : role === 'SFSO'
                ? `SFSO ${sfsoCity} Desk`
                : 'Operations workspace'}{' '}
              <b>{role}</b>
            </p>
            <nav>
              {nav[role].map(p => {
                const Icon = pageIcons[p];
                return (
                  <button
                    key={p}
                    className={p === page ? 'active' : ''}
                    aria-current={p === page ? 'page' : undefined}
                    onClick={() => go(p)}
                  >
                    <span className="nav-icon">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    {pageLabel(p)}
                  </button>
                );
              })}
            </nav>
            <div className="user">
              <div>
                <b>{name}</b>
                <small>{role === 'SFSO' ? `SFSO ${sfsoCity}` : role}</small>
              </div>
              <button
                aria-label="Sign out"
                onClick={() => {
                  log('Signed out');
                  setSigned(false);
                  setNotice('');
                  setMobileNavOpen(false);
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </aside>

          <main>
            <header>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* Mobile hamburger menu toggle */}
                <button
                  type="button"
                  className="mobile-menu-btn"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                  aria-label="Toggle navigation menu"
                  title="Open navigation menu"
                >
                  <Menu size={18} />
                </button>

                <span className="signed-in">
                  <span>
                    Logged in as <b>{name}</b>
                  </span>
                  <span className="header-role">
                    {role === 'SFSO' ? `SFSO (${sfsoCity} Region)` : role}
                  </span>

                {/* City Desk Switcher for SFSO */}
                {role === 'SFSO' && (
                  <span style={{ marginLeft: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <small style={{ color: 'var(--muted)', fontWeight: 600 }}>Switch City Desk:</small>
                    <select
                      value={sfsoCity}
                      onChange={e => {
                        const newCity = e.target.value as 'Islamabad' | 'Lahore' | 'Karachi';
                        setSfsoCity(newCity);
                        setNotice(`Switched to SFSO ${newCity} Desk (${sfsoDesks[newCity].name}). Showing ${newCity} cases & FSOs.`);
                      }}
                      style={{ height: 28, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}
                    >
                      <option value="Islamabad">Islamabad / Rawalpindi (Ahmed)</option>
                      <option value="Lahore">Lahore (Hamza)</option>
                      <option value="Karachi">Karachi (Tariq)</option>
                    </select>
                  </span>
                )}

                {/* FSO Switcher when logged in as FSO */}
                {role === 'FSO' && (
                  <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="hub-tag" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                      📍 {fsoCity}
                    </span>
                    <small style={{ color: 'var(--muted)', fontWeight: 600 }}>Switch Officer:</small>
                    <select
                      value={activeFsoName}
                      onChange={e => {
                        setActiveFsoName(e.target.value);
                        setNotice('Switched active FSO to ' + e.target.value);
                      }}
                      style={{ height: 28, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}
                    >
                      {officers.map(o => (
                        <option key={o.name} value={o.name}>
                          {o.name} — {o.city} ({o.phone})
                        </option>
                      ))}
                    </select>
                  </span>
                )}
              </span>
            </div>
            <div className="header-controls">
                <span className="date">28 October 2026</span>
                <span className="header-avatar" aria-hidden="true">
                  <UserRound size={16} />
                </span>
                <button
                  className="theme-toggle"
                  aria-label="Toggle theme"
                  title={light ? 'Switch to dark mode' : 'Switch to light mode'}
                  aria-pressed={!light}
                  onClick={() => {
                    setLight(!light);
                    try {
                      localStorage.setItem('desk-theme', light ? 'dark' : 'light');
                    } catch {}
                  }}
                >
                  {light ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>
            </header>

            <section className="content">
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {c
                      ? 'CASE DETAILS'
                      : intake
                      ? 'INTAKE'
                      : page === 'Classification'
                      ? 'SECURITY • PENDING CLASSIFICATION'
                      : role === 'SFSO'
                      ? `SFSO ${sfsoCity.toUpperCase()} • ${categories[page]}`
                      : categories[page]}
                  </div>
                  <h1>
                    {c
                      ? `Case ${c.id}`
                      : page === 'Classification'
                      ? 'Classify Incidents'
                      : role === 'SFSO' && page === 'Escalations'
                      ? `Escalations — ${sfsoCity} Desk`
                      : pageLabel(page)}
                  </h1>
                </div>
                {page === 'Classification' && !c && (
                  <button className="track-incidents" onClick={() => go('Case Board')}>
                    Track Incidents
                  </button>
                )}
                {page === 'New Cases' && (
                  <button className="primary" onClick={() => setIntake(!intake)}>
                    {intake ? 'Cancel' : '+ Log a case'}
                  </button>
                )}
              </div>

              {notice && (
                <div role="status" className="notice">
                  {notice}
                  <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
                    ×
                  </button>
                </div>
              )}

              {/* Case Detail View */}
              {c ? (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                    <button onClick={() => setDetail('')}>← Back to list</button>
                    {/* CRO Direct Case Management Buttons */}
                    {role === 'CRO' && (
                      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                        {c.stage === 'New' && (
                          <button
                            className="primary"
                            onClick={() => acknowledgeCaseToSfso(c)}
                            title="Acknowledge case and send official ID to client and SFSO"
                          >
                            <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />
                            Acknowledge & Send to SFSO
                          </button>
                        )}
                        {c.stage !== 'In progress' && (
                          <button
                            onClick={() => markCaseInProgress(c)}
                            style={{ background: 'var(--soft)', borderColor: 'var(--border)' }}
                          >
                            Mark In Progress
                          </button>
                        )}
                        {c.stage !== 'Closed' && (
                          <button
                            onClick={() => closeCaseDirectly(c)}
                            disabled={!c.findings?.some(finding => finding.text.trim())}
                            title="Case findings must be saved before closing"
                            style={{
                              background: 'var(--danger-bg)',
                              color: 'var(--danger-text)',
                              borderColor: 'var(--danger-border)',
                            }}
                          >
                            Close Case Directly
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h2>{c.id}</h2>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {chip(c.priority)}
                        {chip(c.stage)}
                        {c.isQueued && (
                          <span className="queued-badge">
                            Queued Task #{c.queueOrder || 1}
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                      Company: <b>{c.co}</b> • Hub: <b>{c.hub || 'Central Hub'}</b> • City: <b>{c.city}</b> • Issue:{' '}
                      <b>{c.issue}</b>
                    </p>

                    {/* Exact Location & Rider Card */}
                    <div
                      style={{
                        background: 'var(--soft)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 14,
                        margin: '14px 0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            Exact Location (Client-Reported)
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                            📍 {c.exactLocation || 'Exact address not supplied'}
                          </div>
                        </div>
                        <button
                          className="loc-pill"
                          type="button"
                          onClick={() => setViewLocCase(c)}
                        >
                          <Navigation size={12} />
                          <span>View on Map Pin</span>
                        </button>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 20,
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: '1px solid var(--border)',
                          fontSize: 11,
                          color: 'var(--muted)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          Rider: <b>{c.riderName || 'N/A'}</b>
                        </span>
                        <span>
                          Phone:{' '}
                          <a
                            href={'tel:' + c.riderPhone}
                            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            {c.riderPhone || 'N/A'}
                          </a>
                        </span>
                        <span>
                          Incident Time: <b>{c.incidentTime || 'Not recorded'}</b>
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: '14px 0', lineHeight: 1.6 }}>{c.description}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Exposure: PKR {c.amount.toLocaleString()} • Recovered: PKR {c.recovered.toLocaleString()}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Assigned Officer: <b>{c.officer || 'Unassigned'}</b> • Classification:{' '}
                      <b>{c.cls || 'Not classified'}</b>
                    </p>
                    {c.acknowledgedBy && (
                      <p style={{ fontSize: 11, color: '#10b981' }}>
                        ✓ Acknowledged by {c.acknowledgedBy} at {c.acknowledgedAt}
                      </p>
                    )}
                    {c.initialRemarks && <p>Initial remarks: {c.initialRemarks}</p>}
                    {c.report && <p>Field report: {c.report}</p>}

                    {(role === 'CRO' || role === 'SFSO') && (
                      <div className="bar" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        {select('Change Stage', c.findings?.some(finding => finding.text.trim()) ? stages : stages.filter(stage => stage !== 'Closed' || c.stage === 'Closed'), c.stage, v => patch(c, { stage: v }, 'Stage changed to ' + v))}
                        <label>
                          Recovered Amount (PKR)
                          <input
                            type="number"
                            min={0}
                            max={c.amount}
                            value={c.recovered}
                            onChange={e => {
                              const n = Number(e.target.value);
                              if (n >= 0 && n <= c.amount) patch(c, { recovered: n }, 'Recovery updated');
                            }}
                          />
                        </label>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 15, flexWrap: 'wrap' }}>
                      <button
                        className="primary"
                        onClick={() => {
                          setSelected(c.id);
                          go(role === 'FSO' ? 'Case Group' : 'Client Updates');
                        }}
                      >
                        Open Case Conversation →
                      </button>
                      {role === 'CRO' && c.stage !== 'Closed' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFindingsCaseId(c.id);
                            setFindingsDraft('');
                            setFindingFiles([]);
                          }}
                          style={{ fontWeight: 600 }}
                        >
                          + Add Findings
                        </button>
                      )}
                      {(c.stage === 'Closed' || (c.findings && c.findings.length > 0)) && (
                        <button
                          type="button"
                          onClick={() => setReportModalCase(c)}
                          style={{
                            background: 'var(--soft)',
                            borderColor: 'var(--border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 600,
                          }}
                        >
                          <FileText size={14} color="#087f8c" />
                          <span>Generate / Print Case Report</span>
                        </button>
                      )}
                    </div>
                    {c.stage !== 'Closed' && !c.findings?.length && (role === 'CRO' || role === 'SFSO') && (
                      <p className="sub" style={{ color: '#d97706', fontWeight: 500 }}>
                        ⚠️ Case findings are compulsory before closing this case. Click "+ Add Findings" to record findings and attach files.
                      </p>
                    )}
                    {role === 'CRO' && findingsCaseId === c.id && c.stage !== 'Closed' && (
                      <form
                        style={{
                          marginTop: 16,
                          background: 'var(--soft)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 16,
                        }}
                        onSubmit={e => {
                          e.preventDefault();
                          const text = findingsDraft.trim();
                          if (!text) {
                            setNotice('Enter case findings before saving.');
                            return;
                          }
                          const attached = findingFiles.map(file => ({
                            name: file.name,
                            url: URL.createObjectURL(file),
                          }));
                          patch(
                            c,
                            {
                              findings: [
                                ...(c.findings || []),
                                {
                                  text,
                                  author: `${name} (CRO)`,
                                  at: new Date().toISOString(),
                                  files: attached,
                                },
                              ],
                            },
                            'Case findings saved'
                          );
                          setFindingsCaseId('');
                          setFindingsDraft('');
                          setFindingFiles([]);
                          setNotice('Findings saved successfully. These will serve as the official case resolution report.');
                        }}
                      >
                        <label>
                          Findings & Closure Report for {c.id} <span className="req">*</span>
                          <textarea
                            required
                            rows={4}
                            value={findingsDraft}
                            onChange={e => setFindingsDraft(e.target.value)}
                            placeholder="Record the official investigation findings, reconciliation details, and resolution summary for this case..."
                          />
                        </label>
                        <label style={{ marginTop: 10 }}>
                          Attach Evidence / Documents (Optional)
                          <input
                            type="file"
                            multiple
                            onChange={e => setFindingFiles(Array.from(e.target.files || []))}
                            style={{ fontSize: 12, marginTop: 4 }}
                          />
                        </label>
                        {findingFiles.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                            Selected {findingFiles.length} file(s): {findingFiles.map(f => f.name).join(', ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                          <button className="primary" type="submit" disabled={!findingsDraft.trim()}>
                            Save Findings
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFindingsCaseId('');
                              setFindingsDraft('');
                              setFindingFiles([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                    {!!c.findings?.length && (
                      <section style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={16} color="#087f8c" />
                            <span>Official Case Findings</span>
                          </h3>
                          <button
                            type="button"
                            className="loc-pill"
                            onClick={() => setReportModalCase(c)}
                            style={{ fontSize: 11 }}
                          >
                            📄 View as Printable Report
                          </button>
                        </div>
                        {c.findings.map((finding, index) => (
                          <div
                            key={index}
                            className="box"
                            style={{ marginTop: 10, background: 'var(--soft)', borderLeft: '3px solid #087f8c' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <b>{role === 'Client' ? 'CRO' : (finding.author || 'CRO')}</b>
                              <small style={{ color: 'var(--muted)' }}>
                                {new Date(finding.at).toLocaleString()}
                              </small>
                            </div>
                            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0' }}>
                              {finding.text}
                            </p>
                            {finding.files && finding.files.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {finding.files.map((file, fi) => (
                                  <a
                                    key={fi}
                                    href={file.url}
                                    download={file.name}
                                    className="hub-tag"
                                    style={{
                                      textDecoration: 'none',
                                      background: 'var(--card)',
                                      color: 'var(--accent)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    📎 {file.name}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                </>
              ) : intake || page === 'Raise a Case' ? (
                intakeForm
              ) : (
                <>
                  {/* Page: Today */}
                  {page === 'Follow-Ups / Findings' && role === 'CRO' && (
                    <FollowUps
                      cases={visible.filter(c => c.stage !== 'Closed')}
                      open={setDetail}
                      save={(item, followUp) => {
                        patch(
                          item,
                          { followUps: [...(item.followUps || []), { ...followUp, author: name }] },
                          'Case follow-up saved'
                        );
                      }}
                    />
                  )}
                  {page === 'Today' && (
                    <>
                      <p className="sub">Operational command center. Everything requiring immediate review.</p>
                      <div className="stats">
                        <button className="stat" onClick={() => go('New Cases')}>
                          <span>To acknowledge</span>
                          <b>{cases.filter(c => c.stage === 'New').length}</b>
                          <small>View new cases →</small>
                        </button>
                        <button className="stat" onClick={() => go('Client Updates')}>
                          <span>Updates to review</span>
                          <b>
                            {Object.values(msgs).reduce(
                              (n, m) => n + m.filter(x => x.user !== name).length,
                              0
                            )}
                          </b>
                          <small>Open messaging →</small>
                        </button>
                        <button className="stat" onClick={() => go('Case Board')}>
                          <span>In progress</span>
                          <b>{cases.filter(c => c.stage === 'In progress').length}</b>
                          <small>Board view →</small>
                        </button>
                        <button className="stat" onClick={() => go('Case Board')}>
                          <span>Closed cases</span>
                          <b>{cases.filter(c => c.stage === 'Closed').length}</b>
                          <small>Historical records →</small>
                        </button>
                      </div>

                      <div className="box next">
                        <div>
                          <div className="eyebrow">CRO ACTION DESK</div>
                          <h2>{cases.filter(c => c.stage === 'New').length} New Cases Pending Review</h2>
                          <p className="sub">
                            Acknowledge incoming cases to auto-notify clients with generated reference IDs and forward to city SFSO desks.
                          </p>
                        </div>
                        <button className="primary" onClick={() => go('New Cases')}>
                          Open New Cases →
                        </button>
                      </div>

                      <div className="box">
                        <h2>Recent Activity</h2>
                        {logs.slice(0, 6).map((l, i) => (
                          <div className="activity" key={i}>
                            <div>
                              <b>{l.action}</b>
                              <small>
                                {l.user} • {l.id}
                              </small>
                            </div>
                            <time>{l.time}</time>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Page: New Cases (CRO) - Rider Info REMOVED as requested */}
                  {page === 'New Cases' && (
                    <>
                      <p className="sub">
                        Review incoming client cases across all regions. Acknowledge them to auto-dispatch to their respective city SFSO, or resolve directly.
                      </p>
                      <div className="bar">
                        {filter('co', 'Company', companies)}
                        {filter('city', 'City', cities)}
                        {filter('priority', 'Priority', ['High', 'Medium', 'Low'])}
                      </div>

                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>Case ID</th>
                              <th>Company & Hub</th>
                              <th>City</th>
                              <th>Issue</th>
                              <th>Exact Location</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered
                              .filter(c => c.stage === 'New')
                              .map(c => (
                                <tr key={c.id}>
                                  <td>
                                    <button
                                      className="link"
                                      onClick={() => {
                                        setDetail(c.id);
                                        log('Opened case', c.id);
                                      }}
                                    >
                                      <b>{c.id}</b>
                                    </button>
                                    <small>{c.date}</small>
                                  </td>
                                  <td>
                                    <div className="co-hub-cell">
                                      <b>{c.co}</b>
                                      <span className="hub-tag">{c.hub || 'Central Hub'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <b>{c.city}</b>
                                  </td>
                                  <td>
                                    <b>{c.issue}</b>
                                    <small>PKR {c.amount.toLocaleString()}</small>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="loc-pill"
                                      onClick={() => setViewLocCase(c)}
                                      title="Click to view exact location pin"
                                    >
                                      <MapPin size={12} />
                                      <span>{c.exactLocation || c.city}</span>
                                    </button>
                                  </td>
                                  <td>{chip(c.priority)}</td>
                                  <td>{chip(c.stage)}</td>
                                  <td>
                                    <div className="actions">
                                      {/* Only Primary Acknowledge and Send to SFSO */}
                                      <button
                                        className="primary"
                                        style={{ fontSize: 11, padding: '6px 12px' }}
                                        onClick={() => acknowledgeCaseToSfso(c)}
                                        title={`Acknowledge case: auto-sends ID to client and dispatches to SFSO ${c.city}`}
                                      >
                                        Acknowledge & send to SFSO
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {!filtered.some(c => c.stage === 'New') && (
                          <div className="empty">No new intake cases awaiting review.</div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Page: Escalations (SFSO City Isolation) */}
                  {page === 'Escalations' && (
                    <>
                      <p className="sub">
                        <b>{sfsoCity} Region</b> field dispatch console. Managing <b>{sfsoCity}</b> cases and <b>{sfsoCity}</b> FSOs.
                      </p>

                      {/* Escalated Cases Table for Assignment in this City (Top Segment) */}
                      <h2 style={{ marginTop: 16, marginBottom: 8 }}>
                        {sfsoCity} Cases Awaiting Assignment ({visible.filter(c => c.stage === 'Escalated' && !c.isQueued).length})
                      </h2>
                      <div className="tw" style={{ marginBottom: 24 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Case ID</th>
                              <th>Client Hub</th>
                              <th>City</th>
                              <th>Issue</th>
                              <th>Exact Location (Client-Reported)</th>
                              <th>Rider Info</th>
                              <th>Select {sfsoCity} Officer</th>
                              <th>Assignment Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible
                              .filter(c => c.stage === 'Escalated' && !c.isQueued)
                              .map(c => {
                                const selectedOfficer =
                                  c.officer ||
                                  (currentFsoWorkloads.find(w => w.status === 'Free')?.name || visibleFSOs[0]?.name || '');
                                const chosenWorkload = getFsoWorkload(selectedOfficer);

                                return (
                                  <tr key={c.id}>
                                    <td>
                                      <button
                                        className="link"
                                        onClick={() => {
                                          setDetail(c.id);
                                          log('Opened case', c.id);
                                        }}
                                      >
                                        <b>{c.id}</b>
                                      </button>
                                      <small>{c.date}</small>
                                    </td>
                                    <td>
                                      <div className="co-hub-cell">
                                        <b>{c.co}</b>
                                        <span className="hub-tag">{c.hub || 'Hub Not Specified'}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <b>{c.city}</b>
                                    </td>
                                    <td>
                                      <b>{c.issue}</b>
                                      <small>PKR {c.amount.toLocaleString()}</small>
                                      {c.busyReason && (
                                        <div
                                          style={{
                                            background: '#fff1f2',
                                            border: '1px solid #fecdd3',
                                            color: '#be123c',
                                            borderRadius: 6,
                                            padding: '6px 8px',
                                            fontSize: 11,
                                            marginTop: 6,
                                          }}
                                        >
                                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <AlertTriangle size={12} style={{ color: '#e11d48' }} />
                                            Reassignment Requested by {c.busyByOfficer || 'FSO'} ({c.busyReportedAt}):
                                          </div>
                                          <div style={{ marginTop: 2, fontStyle: 'italic', color: '#881337' }}>
                                            "{c.busyReason}"
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      {/* Exact location reported by client */}
                                      <button
                                        type="button"
                                        className="loc-pill"
                                        onClick={() => setViewLocCase(c)}
                                        title="Click to view exact location on map"
                                      >
                                        <MapPin size={12} />
                                        <span>{c.exactLocation || c.city}</span>
                                      </button>
                                    </td>
                                    <td>
                                      <div style={{ fontSize: 11 }}>
                                        <b>{c.riderName || 'N/A'}</b>
                                        <div style={{ color: 'var(--muted)' }}>{c.riderPhone || 'N/A'}</div>
                                        <small>Time: {c.incidentTime || 'N/A'}</small>
                                      </div>
                                    </td>
                                    <td>
                                      <label style={{ minWidth: 220 }}>
                                        <select
                                          value={selectedOfficer}
                                          onChange={e =>
                                            patch(c, { officer: e.target.value }, 'Officer changed to ' + e.target.value)
                                          }
                                        >
                                          {visibleFSOs.map(o => {
                                            const w = getFsoWorkload(o.name);
                                            return (
                                              <option key={o.name} value={o.name}>
                                                {o.name} ({o.city}) — {w.status === 'Free' ? '🟢 FREE (Available)' : `🔴 BUSY (${w.activeCount} active, ${w.queuedCount} queued)`}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </label>
                                    </td>
                                    <td>
                                      {chosenWorkload.status === 'Free' ? (
                                        <button
                                          className="primary"
                                          onClick={() => assignCaseBySfso(c, selectedOfficer)}
                                          title="Officer is free: Dispatch immediately"
                                        >
                                          Assign & Dispatch (Immediate)
                                        </button>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          <button
                                            style={{
                                              background: '#372856',
                                              borderColor: '#7c3aed',
                                              color: '#e9d5ff',
                                              fontSize: 11,
                                            }}
                                            onClick={() => assignCaseBySfso(c, selectedOfficer)}
                                            title="Officer is currently busy: place in their queue"
                                          >
                                            Assign as Queued Case (Next in line)
                                          </button>
                                          <small style={{ color: '#d8b4fe', fontSize: 10 }}>
                                            Will execute after current active case
                                          </small>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                        {!visible.some(c => c.stage === 'Escalated' && !c.isQueued) && (
                          <div className="empty">No {sfsoCity} cases awaiting field officer assignment.</div>
                        )}
                      </div>

                      {/* Two KPI Cards: Busy FSOs and Free FSOs (Compact) */}
                      <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', margin: '8px 0 14px', gap: 10 }}>
                        {/* KPI 1: Busy FSOs */}
                        <div
                          className="stat"
                          style={{
                            cursor: 'pointer',
                            border: kpiFilter === 'Busy' ? '2px solid #f59e0b' : '1px solid var(--border)',
                            background: kpiFilter === 'Busy' ? 'var(--warning-bg)' : 'var(--card)',
                            borderRadius: 6,
                            padding: '10px 14px',
                            transition: 'all .15s ease',
                          }}
                          onClick={() => setKpiFilter(kpiFilter === 'Busy' ? 'All' : 'Busy')}
                          title="Click to view detailed breakdown of Busy FSOs and their active/queued rider cases"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                              Busy FSOs (Working on Cases)
                            </span>
                            <span className="chip warning" style={{ fontSize: 8, padding: '2px 6px' }}>
                              {kpiFilter === 'Busy' ? 'Selected' : 'Filter Busy'}
                            </span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px', color: 'var(--text)' }}>
                            {busyFsoCount}
                            <small style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', display: 'inline', marginLeft: 6 }}>
                              of {visibleFSOs.length} officers
                            </small>
                          </div>
                          <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                            {busyFsoCount > 0 ? 'Occupied with on-ground incidents' : 'No officers currently busy'}
                          </small>
                        </div>

                        {/* KPI 2: Free FSOs */}
                        <div
                          className="stat"
                          style={{
                            cursor: 'pointer',
                            border: kpiFilter === 'Free' ? '2px solid #10b981' : '1px solid var(--border)',
                            background: kpiFilter === 'Free' ? 'var(--success-bg)' : 'var(--card)',
                            borderRadius: 6,
                            padding: '10px 14px',
                            transition: 'all .15s ease',
                          }}
                          onClick={() => setKpiFilter(kpiFilter === 'Free' ? 'All' : 'Free')}
                          title="Click to view detailed breakdown of Free FSOs available for immediate dispatch"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                              Free FSOs (Ready for Dispatch)
                            </span>
                            <span className="chip good" style={{ fontSize: 8, padding: '2px 6px' }}>
                              {kpiFilter === 'Free' ? 'Selected' : 'Filter Free'}
                            </span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px', color: 'var(--text)' }}>
                            {freeFsoCount}
                            <small style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', display: 'inline', marginLeft: 6 }}>
                              of {visibleFSOs.length} officers
                            </small>
                          </div>
                          <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                            Available for immediate dispatch
                          </small>
                        </div>
                      </div>

                      {/* 6-Column Detailed Officer Breakdown Table */}
                      <div className="panel" style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 16px', background: 'var(--hover)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>
                            {kpiFilter === 'Busy'
                              ? `🔴 Busy Officers in ${sfsoCity} (${busyFsoCount}) — Active Cases & Rider Details`
                              : kpiFilter === 'Free'
                              ? `🟢 Free Officers in ${sfsoCity} (${freeFsoCount}) — Ready for Assignment`
                              : `👥 ${sfsoCity} Officer Workload & Availability Overview (${visibleFSOs.length})`}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={{ fontSize: 11, padding: '3px 8px', background: kpiFilter === 'All' ? 'var(--soft)' : 'transparent', color: kpiFilter === 'All' ? 'var(--accent)' : 'var(--muted)' }}
                              onClick={() => setKpiFilter('All')}
                            >
                              All ({visibleFSOs.length})
                            </button>
                            <button
                              type="button"
                              style={{ fontSize: 11, padding: '3px 8px', background: kpiFilter === 'Busy' ? 'var(--soft)' : 'transparent', color: kpiFilter === 'Busy' ? '#f59e0b' : 'var(--muted)' }}
                              onClick={() => setKpiFilter('Busy')}
                            >
                              Busy ({busyFsoCount})
                            </button>
                            <button
                              type="button"
                              style={{ fontSize: 11, padding: '3px 8px', background: kpiFilter === 'Free' ? 'var(--soft)' : 'transparent', color: kpiFilter === 'Free' ? '#10b981' : 'var(--muted)' }}
                              onClick={() => setKpiFilter('Free')}
                            >
                              Free ({freeFsoCount})
                            </button>
                          </div>
                        </div>

                        <div className="tw">
                          <table>
                            <thead>
                              <tr>
                                <th>Officer Name</th>
                                <th>City Coverage</th>
                                <th>Current Status</th>
                                <th>Currently Working On (Incident & Rider Details)</th>
                                <th>Active Cases</th>
                                <th>Queued (Upcoming)</th>
                                <th>On Hold</th>
                                <th>Closed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredWorkloads.map(fso => (
                                <tr key={fso.name}>
                                  <td>
                                    <b>{fso.name}</b>
                                    <small>{fso.phone}</small>
                                  </td>
                                  <td>{fso.city}</td>
                                  <td>
                                    <span className={'fso-status-badge ' + (fso.status === 'Free' ? 'free' : 'busy')}>
                                      <span className="fso-status-dot"></span>
                                      {fso.status === 'Free' ? 'FREE (AVAILABLE)' : 'BUSY (ON RIDER CASE)'}
                                    </span>
                                  </td>
                                  <td>
                                    {fso.currentCase ? (
                                      <div style={{ fontSize: 11 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            className="link"
                                            style={{ fontWeight: 700, fontSize: 12, padding: 0 }}
                                            onClick={() => {
                                              setDetail(fso.currentCase!.id);
                                              log('Opened case from workload breakdown', fso.currentCase!.id);
                                            }}
                                          >
                                            {fso.currentCase.id}
                                          </button>
                                          <span className="hub-tag" style={{ fontSize: 9 }}>{fso.currentCase.hub || fso.currentCase.co}</span>
                                          {fso.currentCase.arrived ? (
                                            <span className="chip good" style={{ fontSize: 8, padding: '1px 5px' }}>On Scene with Rider</span>
                                          ) : fso.currentCase.accepted ? (
                                            <span className="chip in-progress" style={{ fontSize: 8, padding: '1px 5px' }}>En Route to Rider</span>
                                          ) : (
                                            <span className="chip warning" style={{ fontSize: 8, padding: '1px 5px' }}>Assigned (Awaiting Ack)</span>
                                          )}
                                        </div>
                                        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ color: 'var(--text)' }}>
                                            👤 Rider: <b>{fso.currentCase.riderName || 'N/A'}</b>
                                          </span>
                                          <span style={{ color: 'var(--muted)' }}>
                                            • {fso.currentCase.riderPhone || 'No contact'}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                                          📍 {fso.currentCase.exactLocation || fso.currentCase.city} • <b>{fso.currentCase.issue}</b> ({fso.currentCase.incidentTime || 'Time N/A'})
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>● Free (No Active Incident)</span>
                                        <div style={{ fontSize: 10, marginTop: 1 }}>Rider dispatch ready</div>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <b>{fso.activeCount}</b>
                                  </td>
                                  <td>
                                    {fso.queuedCount > 0 ? (
                                      <span className="queued-badge">{fso.queuedCount} upcoming</span>
                                    ) : (
                                      '0'
                                    )}
                                  </td>
                                  <td>{fso.onHoldCount}</td>
                                  <td>{fso.closedCount}</td>
                                </tr>
                              ))}
                              {filteredWorkloads.length === 0 && (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                                    No {kpiFilter.toLowerCase()} officers found in {sfsoCity}.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Page: Field Team (City FSO Directory for SFSO) */}
                  {page === 'Field Team' && (
                    <>
                      <p className="sub">
                        Officer directory and contact roster for <b>{sfsoCity} Region</b>.
                      </p>
                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>Officer Name</th>
                              <th>City Coverage</th>
                              <th>Contact Phone</th>
                              <th>Current Status</th>
                              <th>Direct Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentFsoWorkloads.map(fso => (
                              <tr key={fso.name}>
                                <td>
                                  <b>{fso.name}</b>
                                </td>
                                <td>{fso.city}</td>
                                <td>
                                  <a href={`tel:${fso.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                    {fso.phone}
                                  </a>
                                </td>
                                <td>
                                  <span
                                    className={
                                      'fso-status-badge ' + (fso.status === 'Free' ? 'free' : 'busy')
                                    }
                                  >
                                    <span className="fso-status-dot"></span>
                                    {fso.status === 'Free' ? 'Free (Available)' : 'Busy (Working)'}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="link"
                                    onClick={() => {
                                      setKpiFilter(fso.status);
                                      go('Escalations');
                                    }}
                                  >
                                    Inspect in Escalations &rarr;
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Page: Case Board (Filtered by Role & City for SFSO) */}
                  {page === 'Case Board' && (
                    <>
                      <p className="sub">
                        {role === 'SFSO'
                          ? `Six stages board for ${sfsoCity} Region cases.`
                          : 'Six stages. One unified operational board of every case.'}
                      </p>
                      <div className="board">
                        {stages.map(s => (
                          <section className="column" key={s}>
                            <h3>
                              {s}
                              <span>{visible.filter(c => c.stage === s).length}</span>
                            </h3>
                            {visible
                              .filter(c => c.stage === s)
                              .map(c => (
                                <button
                                  className="card"
                                  key={c.id}
                                  onClick={() => setDetail(c.id)}
                                >
                                  <div>
                                    {chip(c.co)}
                                    {chip(c.priority)}
                                    {c.isQueued && (
                                      <span className="queued-badge" style={{ fontSize: 9 }}>
                                        Queued
                                      </span>
                                    )}
                                  </div>
                                  <b>{c.id}</b>
                                  <p>{c.issue}</p>
                                  <small>
                                    {c.city} • {c.officer || 'Unassigned'}
                                  </small>
                                  {c.exactLocation && (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: 'var(--accent)',
                                        marginTop: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      <MapPin size={10} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.exactLocation}
                                      </span>
                                    </div>
                                  )}
                                </button>
                              ))}
                          </section>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Page: Client Updates / Internal Case Group / Case Group */}
                  {['Client Updates', 'Internal Case Group', 'Case Group'].includes(page) &&
                    chat(page === 'Client Updates' ? 'c' : 'i')}

                  {/* Page: Classification (CRO) */}
                  {page === 'Classification' && role === 'CRO' && (
                    <div className="tw classification-table">
                      <table>
                        <thead>
                          <tr>
                            {[
                              'Case',
                              'Date',
                              'Victim / Accused',
                              'Incident',
                              'Region / Branch',
                              'Amount',
                              'Current TAT',
                              'Classification',
                              'Action & Remarks',
                            ].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visible
                            .filter(c => c.stage !== 'New')
                            .map(c => (
                              <tr key={c.id}>
                                <td>
                                  <span className="classification-case">
                                    <b>{c.id}</b>
                                  </span>
                                  <button
                                    className="link open-detail"
                                    onClick={() => {
                                      setDetail(c.id);
                                      log('Opened case', c.id);
                                    }}
                                  >
                                    Open detail
                                  </button>
                                </td>
                                <td>{c.date}</td>
                                <td>{c.victim || 'Not recorded'}</td>
                                <td className="incident-cell">
                                  <b>{c.issue}</b>
                                  <p>{c.description || 'Client incident awaiting review.'}</p>
                                </td>
                                <td>
                                  {c.city}
                                  <small>{c.hub || c.co}</small>
                                </td>
                                <td>
                                  {c.amount.toLocaleString('en-PK', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td>{c.tat || 'Not set'}</td>
                                <td>
                                  <label htmlFor={'classification-' + c.id}>Classification</label>
                                  <select
                                    id={'classification-' + c.id}
                                    name="classification"
                                    form={'classify-' + c.id}
                                    defaultValue={c.cls}
                                    required
                                  >
                                    <option value="">Select</option>
                                    {['Genuine', 'Negligence', 'Fraud'].map(v => (
                                      <option key={v}>{v}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <form
                                    id={'classify-' + c.id}
                                    onSubmit={e => {
                                      e.preventDefault();
                                      const data = new FormData(e.currentTarget);
                                      patch(
                                        c,
                                        {
                                          cls: String(data.get('classification')),
                                          initialRemarks: String(data.get('remarks')).trim(),
                                        },
                                        'Classification saved'
                                      );
                                    }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}
                                  >
                                    <button
                                      className="primary"
                                      type="submit"
                                      style={{ alignSelf: 'flex-start', minHeight: 34, padding: '6px 16px' }}
                                    >
                                      Submit
                                    </button>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      <label
                                        htmlFor={'remarks-' + c.id}
                                        style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}
                                      >
                                        Initial Remarks
                                      </label>
                                      <textarea
                                        id={'remarks-' + c.id}
                                        name="remarks"
                                        defaultValue={c.initialRemarks || ''}
                                        placeholder="Enter initial investigation remarks..."
                                        rows={2}
                                        style={{ fontSize: 11, resize: 'vertical' }}
                                      />
                                    </div>
                                  </form>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!visible.some(c => c.stage !== 'New') && (
                        <div className="empty">No incidents awaiting classification.</div>
                      )}
                    </div>
                  )}

                  {/* Page: My Cases (Client) */}
                  {page === 'My Cases' && role === 'Client' && (
                    <>
                      <p className="sub">
                        {co} cases intake and tracking. Follow requests from initial logging to resolution.
                      </p>
                      {/* Clickable KPI filter cards for Client */}
                      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <button
                          type="button"
                          className={`stat ${clientKpiFilter === 'open' ? 'active-kpi' : ''}`}
                          onClick={() => setClientKpiFilter(prev => prev === 'open' ? 'all' : 'open')}
                          title="Click to filter only open/active cases"
                          style={{
                            border: clientKpiFilter === 'open' ? '2px solid #087f8c' : '1px solid var(--border)',
                            background: clientKpiFilter === 'open' ? 'var(--soft)' : 'var(--card)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Open Cases</span>
                            {clientKpiFilter === 'open' && (
                              <span className="chip primary" style={{ fontSize: 8, padding: '2px 6px' }}>
                                Selected
                              </span>
                            )}
                          </div>
                          <b>{visible.filter(c => c.stage !== 'Closed').length}</b>
                          <small>Currently active (Click to filter)</small>
                        </button>

                        <button
                          type="button"
                          className={`stat ${clientKpiFilter === 'waiting' ? 'active-kpi' : ''}`}
                          onClick={() => setClientKpiFilter(prev => prev === 'waiting' ? 'all' : 'waiting')}
                          title="Click to filter cases waiting for CRO acknowledgement"
                          style={{
                            border: clientKpiFilter === 'waiting' ? '2px solid #f59e0b' : '1px solid var(--border)',
                            background: clientKpiFilter === 'waiting' ? 'var(--warning-bg)' : 'var(--card)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Waiting CRO Acknowledgement</span>
                            {clientKpiFilter === 'waiting' && (
                              <span className="chip warning" style={{ fontSize: 8, padding: '2px 6px' }}>
                                Selected
                              </span>
                            )}
                          </div>
                          <b>{visible.filter(c => c.stage === 'New').length}</b>
                          <small>In review queue (Click to filter)</small>
                        </button>

                        <button
                          type="button"
                          className={`stat ${clientKpiFilter === 'closed' ? 'active-kpi' : ''}`}
                          onClick={() => setClientKpiFilter(prev => prev === 'closed' ? 'all' : 'closed')}
                          title="Click to filter closed / resolved cases"
                          style={{
                            border: clientKpiFilter === 'closed' ? '2px solid #10b981' : '1px solid var(--border)',
                            background: clientKpiFilter === 'closed' ? '#ecfdf5' : 'var(--card)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Closed / Resolved</span>
                            {clientKpiFilter === 'closed' && (
                              <span className="chip closed" style={{ fontSize: 8, padding: '2px 6px' }}>
                                Selected
                              </span>
                            )}
                          </div>
                          <b>{visible.filter(c => c.stage === 'Closed').length}</b>
                          <small>Completed (Click to filter)</small>
                        </button>
                      </div>

                      {clientKpiFilter !== 'all' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 12px', fontSize: 12 }}>
                          <span>
                            Filtering table: <b>{clientKpiFilter === 'open' ? 'Open Cases' : clientKpiFilter === 'waiting' ? 'Waiting CRO Acknowledgement' : 'Closed / Resolved'}</b>
                          </span>
                          <button
                            type="button"
                            onClick={() => setClientKpiFilter('all')}
                            style={{ padding: '2px 8px', fontSize: 11 }}
                          >
                            Clear KPI Filter ✕
                          </button>
                        </div>
                      )}

                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>Case ID</th>
                              <th>Client Hub</th>
                              <th>Issue</th>
                              <th>Exact Location</th>
                              <th>Rider Name</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Workflow Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible
                              .filter(c => {
                                if (clientKpiFilter === 'open') return c.stage !== 'Closed';
                                if (clientKpiFilter === 'waiting') return c.stage === 'New';
                                if (clientKpiFilter === 'closed') return c.stage === 'Closed';
                                return true;
                              })
                              .map(c => (
                                <tr key={c.id}>
                                  <td>
                                    <button
                                      className="link"
                                      onClick={() => {
                                        setDetail(c.id);
                                        log('Opened case', c.id);
                                      }}
                                    >
                                      <b>{c.id}</b>
                                    </button>
                                    <small>{c.date}</small>
                                  </td>
                                  <td>
                                    <span className="hub-tag">{c.hub || 'Central Hub'}</span>
                                  </td>
                                  <td>
                                    <b>{c.issue}</b>
                                    <small>PKR {c.amount.toLocaleString()}</small>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="loc-pill"
                                      onClick={() => setViewLocCase(c)}
                                    >
                                      <MapPin size={11} />
                                      <span>{c.exactLocation || c.city}</span>
                                    </button>
                                  </td>
                                  <td>{c.riderName || 'N/A'}</td>
                                  <td>{chip(c.priority)}</td>
                                  <td>{chip(c.stage)}</td>
                                  <td>
                                    {c.stage === 'New' ? (
                                      <span style={{ color: '#eab308', fontWeight: 600, fontSize: 11 }}>
                                        ⏳ Received — Awaiting CRO Acknowledgement
                                      </span>
                                    ) : c.stage === 'Closed' ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ color: '#10b981', fontWeight: 600, fontSize: 11 }}>
                                          ✓ Resolved & Closed
                                        </span>
                                        <button
                                          type="button"
                                          className="loc-pill"
                                          style={{ fontSize: 10, padding: '3px 8px', color: 'var(--accent)', borderColor: 'var(--border)' }}
                                          onClick={() => setReportModalCase(c)}
                                          title="View official resolution report"
                                        >
                                          <FileText size={10} />
                                          <span>View Report</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ color: '#087f8c', fontWeight: 600, fontSize: 11 }}>
                                          🚀 Dispatched to Field Team ({c.officer || 'SFSO Assigned'})
                                        </span>
                                        {c.findings && c.findings.length > 0 && (
                                          <button
                                            type="button"
                                            className="loc-pill"
                                            style={{ fontSize: 10, padding: '3px 8px', color: 'var(--accent)', borderColor: 'var(--border)' }}
                                            onClick={() => setReportModalCase(c)}
                                            title="View official resolution report"
                                          >
                                            <FileText size={10} />
                                            <span>View Report</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {visible.filter(c => {
                          if (clientKpiFilter === 'open') return c.stage !== 'Closed';
                          if (clientKpiFilter === 'waiting') return c.stage === 'New';
                          if (clientKpiFilter === 'closed') return c.stage === 'Closed';
                          return true;
                        }).length === 0 && (
                          <div className="empty">No matching cases for selected filter.</div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Page: My Cases (FSO Mobile Style Workspace) */}
                  {page === 'My Cases' && role === 'FSO' && (
                    <div className="phone">
                      {/* Officer Profile & City Header */}
                      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: 16 }}>Field Officer Console</h2>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>Officer: <b style={{ color: 'var(--text)' }}>{name}</b></span>
                              <span className="hub-tag" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', fontSize: 9 }}>
                                📍 {fsoCity} Coverage
                              </span>
                              <span>📞 {activeOfficer.phone}</span>
                            </div>
                          </div>
                          <span className={'fso-status-badge ' + (getFsoWorkload(name).isBusy ? 'busy' : 'free')} style={{ fontSize: 9 }}>
                            <span className="fso-status-dot"></span>
                            {getFsoWorkload(name).isBusy ? 'STATUS: BUSY' : 'STATUS: FREE (READY)'}
                          </span>
                        </div>

                        {/* Quick Officer & City Switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--soft)', padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 10 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>Switch Officer & City:</span>
                          <select
                            value={activeFsoName}
                            onChange={e => {
                              setActiveFsoName(e.target.value);
                              setNotice(`Switched active Field Officer to ${e.target.value} (${officers.find(o => o.name === e.target.value)?.city})`);
                            }}
                            style={{ flex: 1, height: 26, fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}
                          >
                            {officers.map(o => (
                              <option key={o.name} value={o.name}>
                                {o.name} — {o.city} ({o.phone})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* View Tabs: My Assigned Cases vs All City Incidents */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              fontSize: 11,
                              padding: '6px 10px',
                              background: fsoViewMode === 'assigned' ? 'var(--accent)' : 'var(--soft)',
                              color: fsoViewMode === 'assigned' ? '#fff' : 'var(--text)',
                              fontWeight: 700,
                              borderRadius: 4,
                              border: fsoViewMode === 'assigned' ? '1px solid var(--accent)' : '1px solid var(--border)',
                            }}
                            onClick={() => setFsoViewMode('assigned')}
                          >
                            My Assigned Cases ({visible.length})
                          </button>
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              fontSize: 11,
                              padding: '6px 10px',
                              background: fsoViewMode === 'city' ? 'var(--accent)' : 'var(--soft)',
                              color: fsoViewMode === 'city' ? '#fff' : 'var(--text)',
                              fontWeight: 700,
                              borderRadius: 4,
                              border: fsoViewMode === 'city' ? '1px solid var(--accent)' : '1px solid var(--border)',
                            }}
                            onClick={() => setFsoViewMode('city')}
                          >
                            All {fsoCity} Cases ({fsoCityCases.length})
                          </button>
                        </div>
                      </div>

                      {/* City Wide Feed Tab */}
                      {fsoViewMode === 'city' && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                            <span>📍 All Incidents in {fsoCity} Region ({fsoCityCases.length})</span>
                            <span style={{ fontSize: 10, color: 'var(--accent)' }}>City Operational Picture</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {fsoCityCases.map(c => (
                              <div
                                key={c.id}
                                className="box"
                                style={{
                                  margin: 0,
                                  borderLeft: c.officer === name ? '4px solid var(--accent)' : '1px solid var(--border)',
                                  background: c.officer === name ? 'var(--soft)' : 'var(--card)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <b>{c.id}</b>
                                    <span className="hub-tag" style={{ fontSize: 9 }}>{c.hub || c.co}</span>
                                  </div>
                                  {chip(c.stage)}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, margin: '4px 0 2px' }}>
                                  {c.issue} • PKR {c.amount.toLocaleString()}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  📍 {c.exactLocation || c.city}
                                </div>
                                <div style={{ fontSize: 11, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>👤 Rider: <b>{c.riderName || 'N/A'}</b> ({c.riderPhone || 'No phone'})</span>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: c.officer === name ? 'var(--accent)' : 'var(--muted)' }}>
                                    {c.officer ? (c.officer === name ? '★ Assigned to YOU' : `Officer: ${c.officer}`) : 'Unassigned (In Queue)'}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {fsoCityCases.length === 0 && (
                              <div className="empty" style={{ padding: 15, fontSize: 12 }}>
                                No reported incidents in {fsoCity} currently.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Section 1 & 2: Assigned Cases */}
                      {fsoViewMode === 'assigned' && (
                        <>
                          <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>
                            ⚡ Current Active Cases ({visible.filter(c => c.stage === 'In progress' && !c.isQueued).length})
                          </div>

                        {visible
                          .filter(c => c.stage === 'In progress' && !c.isQueued)
                          .map(c => (
                            <div className="box" key={c.id} style={{ borderColor: 'var(--accent)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3>{c.id}</h3>
                                {chip(c.priority)}
                              </div>
                              <p style={{ margin: '4px 0 8px', fontSize: 12 }}>
                                <b>{c.co}</b> • {c.hub} • {c.issue}
                              </p>

                              {/* Exact Location Card for FSO */}
                              <div
                                style={{
                                  background: 'var(--soft)',
                                  padding: 10,
                                  borderRadius: 6,
                                  margin: '8px 0',
                                  fontSize: 11,
                                }}
                              >
                                <div style={{ color: 'var(--muted)', fontSize: 9 }}>EXACT DISPATCH LOCATION:</div>
                                <b style={{ color: 'var(--text)', display: 'block', margin: '2px 0 4px' }}>
                                  📍 {c.exactLocation || c.city}
                                </b>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                  <span>
                                    Rider: <b>{c.riderName}</b>
                                  </span>
                                  <span>
                                    Phone: <b>{c.riderPhone}</b>
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                                <button
                                  type="button"
                                  className="loc-pill"
                                  onClick={() => setViewLocCase(c)}
                                  style={{ flex: 1, justifyContent: 'center' }}
                                >
                                  <Navigation size={12} />
                                  <span>Open Map Pin</span>
                                </button>
                                <button
                                  type="button"
                                  className="loc-pill"
                                  style={{ flex: 1, justifyContent: 'center' }}
                                  onClick={() => {
                                    setSelected(c.id);
                                    go('Case Group');
                                  }}
                                >
                                  <Radio size={12} />
                                  <span>Live Chat</span>
                                </button>
                              </div>

                              {c.stage !== 'Closed' && (
                                <>
                                  {/* Acknowledge Button if not yet acknowledged */}
                                  {!c.fsoAcknowledged && !c.accepted ? (
                                    <button
                                      type="button"
                                      className="primary full"
                                      style={{
                                        background: '#059669',
                                        borderColor: '#059669',
                                        padding: '9px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        fontWeight: 700,
                                        fontSize: 12,
                                        margin: '4px 0 8px',
                                      }}
                                      onClick={() => handleFsoAcknowledge(c)}
                                    >
                                      <CheckCircle2 size={15} />
                                      <span>✓ Acknowledge Case & Start Dispatch</span>
                                    </button>
                                  ) : (
                                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0 6px' }}>
                                      <CheckCircle2 size={13} />
                                      <span>Acknowledged at {c.fsoAcknowledgedAt || c.date} — En route / Active</span>
                                    </div>
                                  )}

                                  <button
                                    className="full"
                                    disabled={(!c.fsoAcknowledged && !c.accepted) || c.arrived}
                                    onClick={() => patch(c, { arrived: true }, 'Arrival confirmed (Simulated GPS)')}
                                  >
                                    {c.arrived ? '✓ Arrival Confirmed (On Scene)' : 'Confirm Arrival'}
                                  </button>

                                  {/* Report Busy / Unable to Proceed */}
                                  <button
                                    type="button"
                                    style={{
                                      background: '#fff1f2',
                                      color: '#be123c',
                                      border: '1px solid #fecdd3',
                                      fontSize: 11,
                                      padding: '8px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                      width: '100%',
                                      margin: '8px 0 12px',
                                      borderRadius: 6,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                      setBusyModalCase(c);
                                      setBusyReasonText('');
                                    }}
                                    title="Report that you are busy or working elsewhere and cannot handle this case"
                                  >
                                    <AlertTriangle size={13} />
                                    <span>Report Busy / Unable to Proceed</span>
                                  </button>

                                  <form
                                    onSubmit={e => {
                                      e.preventDefault();
                                      const d = new FormData(e.currentTarget);
                                      patch(
                                        c,
                                        {
                                          report:
                                            String(d.get('report')) +
                                            ' | Evidence: ' +
                                            d
                                              .getAll('evidence')
                                              .filter(v => v instanceof File && (v as File).name)
                                              .map(v => (v as File).name)
                                              .join(', '),
                                        },
                                        'Field report submitted'
                                      );
                                      e.currentTarget.reset();
                                    }}
                                  >
                                    <label>
                                      Field Findings
                                      <textarea
                                        name="report"
                                        required
                                        minLength={20}
                                        placeholder="Record detailed field findings (at least 20 chars)..."
                                      />
                                    </label>
                                    <label>
                                      Evidence Photos / Voice Note
                                      <input name="evidence" type="file" multiple accept="image/*,audio/*" />
                                    </label>
                                    <button className="full primary" disabled={!c.arrived}>
                                      Send Field Report
                                    </button>
                                  </form>
                                </>
                              )}
                            </div>
                          ))}

                        {!visible.some(c => c.stage === 'In progress' && !c.isQueued) && (
                          <div className="empty" style={{ padding: 15, fontSize: 12 }}>
                            No active cases in progress right now. You are free for immediate dispatch!
                          </div>
                        )}
                      </div>

                      {/* Section 2: Queued / Upcoming Cases (To do after current case) */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📋 Upcoming Queued Cases ({visible.filter(c => c.isQueued && c.stage !== 'Closed').length})</span>
                        </div>

                        {visible
                          .filter(c => c.isQueued && c.stage !== 'Closed')
                          .map((c, idx) => (
                            <div
                              className="box"
                              key={c.id}
                              style={{ borderLeft: '3px solid #8b5cf6', background: 'var(--card)' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="queued-badge">Upcoming Case #{idx + 1}</span>
                                {chip(c.priority)}
                              </div>
                              <h3 style={{ margin: '8px 0 4px' }}>{c.id}</h3>
                              <p style={{ margin: 0, fontSize: 12 }}>
                                {c.co} • {c.hub} • {c.issue}
                              </p>

                              <div style={{ background: 'var(--soft)', padding: 8, borderRadius: 5, margin: '8px 0', fontSize: 11 }}>
                                <div>📍 Location: <b>{c.exactLocation || c.city}</b></div>
                                <div style={{ marginTop: 2 }}>Rider: <b>{c.riderName}</b> ({c.riderPhone})</div>
                              </div>

                              <p className="badge-queued-notice" style={{ margin: '6px 0 10px' }}>
                                ℹ️ Assigned by SFSO to execute immediately after your active case is resolved.
                              </p>

                              <button
                                className="primary full"
                                style={{ background: '#7c3aed', borderColor: '#8b5cf6' }}
                                onClick={() =>
                                  patch(
                                    c,
                                    { isQueued: false, stage: 'In progress', accepted: true },
                                    'Started next queued case: ' + c.id
                                  )
                                }
                              >
                                Start This Case Next Now →
                              </button>

                              <button
                                type="button"
                                style={{
                                  background: '#fff1f2',
                                  color: '#be123c',
                                  border: '1px solid #fecdd3',
                                  fontSize: 11,
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  width: '100%',
                                  marginTop: 8,
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setBusyModalCase(c);
                                  setBusyReasonText('');
                                }}
                                title="Report that you are busy or working elsewhere and cannot handle this queued case"
                              >
                                <AlertTriangle size={13} />
                                <span>Report Busy / Unable to Proceed</span>
                              </button>
                            </div>
                          ))}

                        {!visible.some(c => c.isQueued && c.stage !== 'Closed') && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: 10 }}>
                            No queued cases pending.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                )}

                  {/* Page: Reports */}
                  {page === 'Reports' && (
                    <>
                      <p className="sub">
                        {role === 'Client'
                          ? `Consolidated reports for ${co} only.`
                          : role === 'SFSO'
                          ? `Operational reports for ${sfsoCity} Region cases.`
                          : 'Operational analytics. Filter by company, city, date, status, classification, or Case ID.'}
                      </p>
                      <div className="bar">
                        <label>
                          From
                          <input
                            type="date"
                            value={f.from || ''}
                            onChange={e => setF({ ...f, from: e.target.value })}
                          />
                        </label>
                        <label>
                          To
                          <input
                            type="date"
                            value={f.to || ''}
                            min={f.from}
                            onChange={e => setF({ ...f, to: e.target.value })}
                          />
                        </label>
                        {role !== 'Client' && filter('co', 'Company', companies)}
                        {role !== 'SFSO' && filter('city', 'City', cities)}
                        {filter('stage', 'Status', stages)}
                        {filter('cls', 'Classification', ['Genuine', 'Negligence', 'Fraud'])}
                        <label>
                          Case ID
                          <input
                            placeholder="Search ID..."
                            value={f.search || ''}
                            onChange={e => setF({ ...f, search: e.target.value })}
                          />
                        </label>
                        <button onClick={() => setF({})}>Reset</button>
                        <button className="primary" onClick={exportCsv}>
                          Export CSV
                        </button>
                      </div>

                      <div className="stats">
                        <div className="stat">
                          <span>Total Cases</span>
                          <b>{filtered.length}</b>
                          <small>Filtered records</small>
                        </div>
                        <div className="stat">
                          <span>Total Exposure (PKR)</span>
                          <b>{filtered.reduce((n, c) => n + c.amount, 0).toLocaleString()}</b>
                          <small>Reported exposure</small>
                        </div>
                        <div className="stat">
                          <span>Recovered (PKR)</span>
                          <b>{filtered.reduce((n, c) => n + c.recovered, 0).toLocaleString()}</b>
                          <small>Recovered amount</small>
                        </div>
                      </div>

                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>Case ID</th>
                              <th>Client & Hub</th>
                              <th>Date Reported</th>
                              <th>City</th>
                              <th>Exact Location</th>
                              <th>Incident Type</th>
                              <th>Classification</th>
                              <th>Total Amount</th>
                              <th>Recovered</th>
                              <th>Officer</th>
                              <th>Status</th>
                              <th>Official Report</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(c => (
                              <tr key={c.id}>
                                <td>
                                  <b>{c.id}</b>
                                </td>
                                <td>
                                  <div className="co-hub-cell">
                                    <b>{c.co}</b>
                                    <span className="hub-tag">{c.hub || 'Central Hub'}</span>
                                  </div>
                                </td>
                                <td>{c.date}</td>
                                <td>{c.city}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="loc-pill"
                                    onClick={() => setViewLocCase(c)}
                                  >
                                    <MapPin size={10} />
                                    <span>{c.exactLocation || c.city}</span>
                                  </button>
                                </td>
                                <td>{c.issue}</td>
                                <td>{c.cls || '—'}</td>
                                <td>PKR {c.amount.toLocaleString()}</td>
                                <td>PKR {c.recovered.toLocaleString()}</td>
                                <td>{c.officer || 'Unassigned'}</td>
                                <td>{chip(c.stage)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="loc-pill"
                                    style={{ fontWeight: 600, color: 'var(--accent)', borderColor: 'var(--border)' }}
                                    onClick={() => setReportModalCase(c)}
                                    title="Generate and print official incident resolution report including findings"
                                  >
                                    <FileText size={11} />
                                    <span>Generate Report</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!filtered.length && <div className="empty">No matching records found.</div>}
                      </div>
                    </>
                  )}

                  {/* Page: Audit Logs */}
                  {page === 'Audit Logs' && (
                    <>
                      <p className="sub">
                        Immutable session activity log. Entries record timestamped operations and dispatches.
                      </p>
                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>User & Role</th>
                              <th>Activity Performed</th>
                              <th>Case ID</th>
                              <th>Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((l, i) => (
                              <tr key={i}>
                                <td>
                                  <b>{l.user}</b>
                                </td>
                                <td>{l.action}</td>
                                <td>{l.id}</td>
                                <td>{l.time}</td>
                              </tr>
                            ))}
                            {!logs.length && (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                                  No session actions recorded yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
            <footer>
              <span>Mohafiz • Secure. Track. Resolve.</span>
              <span>Operations Desk Prototype • Real-time in-memory workflow</span>
            </footer>
          </main>

          {/* Mobile Bottom Quick-Access Thumb Bar (Visible on mobile screens only) */}
          <nav className="mobile-bottom-bar" aria-label="Mobile Navigation Bar">
            {nav[role].slice(0, 4).map(p => {
              const Icon = pageIcons[p];
              return (
                <button
                  key={p}
                  type="button"
                  className={'mobile-bottom-item ' + (p === page ? 'active' : '')}
                  onClick={() => go(p)}
                  aria-label={p}
                >
                  <Icon size={18} />
                  <span>{pageLabel(p).split(' ')[0]}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={'mobile-bottom-item ' + (mobileNavOpen ? 'active' : '')}
              onClick={() => setMobileNavOpen(true)}
              aria-label="All Navigation Pages"
            >
              <Menu size={18} />
              <span>Menu</span>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
