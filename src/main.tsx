import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck, LayoutDashboard, Inbox, Columns3, MessagesSquare, MessageSquareLock,
  Tags, ChartNoAxesCombined, History, ArrowUpRight, Users, BriefcaseBusiness,
  PlusCircle, LogOut, UserRound, MapPin, Phone, Clock, Building2, Search,
  CheckCircle2, AlertCircle, Navigation, Radio, Send, X, ExternalLink, Check, AlertTriangle,
  Eye, EyeOff, FileText, Printer, Paperclip, Menu, Smile, Settings, Bell, RotateCcw
} from 'lucide-react';
import './theme-desk.css';
import AuthScreen from './AuthScreen';
import WorkbookPortal from './WorkbookPortal';
import type { WorkbookProfile } from './workbookData';
import { supabase } from './supabase';
import { restoreFsoDemoCases } from './fsoDemo';
import FsoWorkspace from './FsoWorkspace';
import './mobile-portal.css';
import { EvidenceList } from './FieldReportForm';
import { evidenceKind, persistFieldReport, MAX_ATTACHMENTS, EVIDENCE_LIMIT, type FieldSubmission, type SourceRecord } from './fieldEvidence';
import FollowUps, { FollowUpForm, type FollowUpItem } from './FollowUps';

// Dedicated type for official CRO manual findings
export type CaseFinding = {
  kind?: 'classification';
  text: string;
  author: string;
  at: string;
  files?: { name: string; url: string }[];
};

// Page Icons & Categories
const pageIcons: Record<string, typeof ShieldCheck> = {
  'Dashboard': LayoutDashboard,
  'New Cases': Inbox,
  'Case Board': Columns3,
  'Client Updates': MessagesSquare,
  'Follow-Ups / Findings': History,
  'Internal Case Group': MessageSquareLock,
  'Case Group': MessageSquareLock,
  'Mohafiz X Islamabad': MessageSquareLock,
  'Mohafiz X Karachi': MessageSquareLock,
  'Mohafiz X Lahore': MessageSquareLock,
  'Mohafiz X PostEx': MessagesSquare,
  'Mohafiz X Daraz': MessagesSquare,
  'Mohafiz X Buscaro': MessagesSquare,
  'Classification': Tags,
  'Reports': ChartNoAxesCombined,
  'Audit Logs': History,
  'Escalations': ArrowUpRight,
  'Field Team': Users,
  'My Cases': BriefcaseBusiness,
  'Raise a Case': PlusCircle,
};

const categories: Record<string, string> = {
  'Dashboard': 'OVERVIEW',
  'New Cases': 'INTAKE',
  'Case Board': 'CASE MANAGEMENT',
  'Client Updates': 'COMMUNICATION',
  'Follow-Ups / Findings': 'INVESTIGATION',
  'Internal Case Group': 'COMMUNICATION',
  'Case Group': 'COMMUNICATION',
  'Mohafiz X Islamabad': 'CITY OPERATIONS CHAT',
  'Mohafiz X Karachi': 'CITY OPERATIONS CHAT',
  'Mohafiz X Lahore': 'CITY OPERATIONS CHAT',
  'Mohafiz X PostEx': 'CLIENT CHAT',
  'Mohafiz X Daraz': 'CLIENT CHAT',
  'Mohafiz X Buscaro': 'CLIENT CHAT',
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
  fieldReports?: FieldSubmission[];
  sourceRecord?: SourceRecord;
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
const cityGroups = ['Islamabad', 'Karachi', 'Lahore'] as const;
const companyGroupPage = (company: string) => `Mohafiz X ${company}`;
const cityGroupPage = (city: string) => `Mohafiz X ${city === 'Karachi' || city === 'Lahore' ? city : 'Islamabad'}`;
const clientGroupKey = (company: string) => `cg:${company}`;
const internalGroupKey = (city: string) => `ig:${city === 'Karachi' || city === 'Lahore' ? city : 'Islamabad'}`;
const internalConversationKey = (caseItem: Pick<C, 'id' | 'city'>) =>
  `i${cityGroupPage(caseItem.city).slice('Mohafiz X '.length)}${caseItem.id}`;

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
  CRO: ['Dashboard', 'Case Board', 'Reports'],
  'CRO Manager': ['Dashboard', 'Case Board', 'Reports', 'Audit Logs'],
  SFSO: ['Escalations', 'Case Board', 'Field Team'],
  SOM: ['Case Board', 'Field Team'],
  FSO: ['My Cases'],
  Client: ['My Cases', 'Raise a Case', 'Reports'],
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
  caseId?: string;
  sentAt?: number;
  type?: 'text' | 'file' | 'location';
  location?: {
    lat: number;
    lng: number;
    address: string;
    accuracy?: string;
  };
};

function App() {
  const demoActive = useRef(false);
  const [liveProfile, setLiveProfile] = useState<WorkbookProfile | null>(null);
  const demoEvidenceUrls = useRef(new Set<string>());
  useEffect(() => () => { demoEvidenceUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).get('auth') === 'recovery');
  const [authMessage, setAuthMessage] = useState('');
  const [role, setRole] = useState('CRO');
  const [activeCroName, setActiveCroName] = useState('CRO');
  const [sfsoCity, setSfsoCity] = useState<'Islamabad' | 'Lahore' | 'Karachi'>('Islamabad'); // 3 SFSOs
  const isCro = role === 'CRO' || role === 'CRO Manager';
  const canViewAuditLogs = role === 'CRO Manager';
  const isSupervisor = role === 'SFSO' || role === 'SOM';
  const canManageFollowUps = isCro;
  const [co, setCo] = useState('PostEx');
  const [signed, setSigned] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState('');
  const [page, setPage] = useState('Dashboard');
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
  const [fsoCaseFilter, setFsoCaseFilter] = useState<'all' | 'open' | 'closed' | 'inProgress' | 'pending'>('all');
  const [logs, setLogs] = useState<{ user: string; action: string; id: string; time: string; at: number; role: string; city: string }[]>([]);
  const [chatReadCursors, setChatReadCursors] = useState<Record<string, number>>({});
  const [chatSeenReceipts, setChatSeenReceipts] = useState<Record<string, { messageId: string; viewers: string[] }>>({});
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>({
    'cPOS-RAW-OCT-26-1': [
      { user: 'PostEx user', role: 'Client', text: 'Rider reported payment not credited from commercial market hub.', time: '09:27', type: 'text' },
      { user: 'Mohafiz Operations', role: 'CRO', text: 'Case logged. Reviewing with accounts desk.', time: '09:31', type: 'text' },
    ],
    'iLahorePOS-LAH-OCT-26-1': [
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
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [activeSearchMessage, setActiveSearchMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState('');
  const [boardCity, setBoardCity] = useState('');
  const [boardStatus, setBoardStatus] = useState('');
  const [inlineFollowUpCase, setInlineFollowUpCase] = useState('');
  const [findingsCaseId, setFindingsCaseId] = useState('');
  const [findingsDraft, setFindingsDraft] = useState('');
  const [findingFiles, setFindingFiles] = useState<File[]>([]);
  const [clientKpiFilter, setClientKpiFilter] = useState<'all' | 'open' | 'waiting' | 'closed'>('all');
  const [reportModalCase, setReportModalCase] = useState<C | null>(null);
  const [intake, setIntake] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showDashboardBack, setShowDashboardBack] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
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
    isCro
      ? activeCroName
      : isSupervisor
      ? role === 'SOM' ? `SOM ${sfsoCity}` : `${activeSfso.name} (${sfsoCity})`
      : role === 'FSO'
      ? activeFsoName
      : co + ' user';

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
      sentAt: Date.now(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      [internalConversationKey(caseItem)]: [...(all[internalConversationKey(caseItem)] || []), internalMsg],
    }));

    setNotice(`Case #${caseItem.id} acknowledged by ${name}. Confirmation message sent to internal group.`);
  };

  const time = () =>
    new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' PKT';

  const log = (action: string, id = '—') =>
    setLogs(v => [{ user: name + ' • ' + role, action, id, time: time(), at: Date.now(), role, city: cases.find(c => c.id === id)?.city || (isSupervisor ? sfsoCity : role === 'FSO' ? fsoCity : '') }, ...v]);

  const go = (p: string, fromDashboard = false) => {
    if (p === 'Audit Logs' && !canViewAuditLogs) return;
    setPage(p);
    setShowDashboardBack(fromDashboard);
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
    if (isSupervisor) return sfsoCityMatches(c.city, sfsoCity);
    return true; // CRO sees all
  });
  const cityChatPages = isCro
    ? cityGroups.map(city => cityGroupPage(city))
    : isSupervisor
    ? [cityGroupPage(sfsoCity)]
    : role === 'FSO'
    ? [cityGroupPage(fsoCity)]
    : [];
  const companyChatPages = role === 'Client'
    ? [companyGroupPage(co)]
    : role === 'FSO'
    ? []
    : companies.map(companyGroupPage);
  const navPages = [...nav[role], ...cityChatPages, ...companyChatPages];
  const chatPages = [...cityGroups.map(cityGroupPage), ...companies.map(companyGroupPage)];
  const chatCasesForPage = (chatPage: string) => {
    const company = companies.find(item => companyGroupPage(item) === chatPage);
    if (company) return visible.filter(caseItem => caseItem.co === company);
    const city = cityGroups.find(item => cityGroupPage(item) === chatPage);
    return city ? visible.filter(caseItem => cityGroupPage(caseItem.city) === chatPage) : [];
  };
  const getGroupMessages = (chatPage: string) => {
    const company = companies.find(item => companyGroupPage(item) === chatPage);
    const city = cityGroups.find(item => cityGroupPage(item) === chatPage);
    if (!company && !city) return [];
    const channel = company ? 'c' : 'i';
    const groupKey = company ? clientGroupKey(company) : internalGroupKey(city!);
    return [
      ...chatCasesForPage(chatPage).flatMap(caseItem => {
        const key = channel === 'c' ? 'c' + caseItem.id : internalConversationKey(caseItem);
        return (msgs[key] || []).map((message, index) => ({
          ...message,
          caseId: message.caseId || caseItem.id,
          sentAt: message.sentAt || 0,
          sourceKey: `${key}-${index}`,
        }));
      }),
      ...(msgs[groupKey] || []).map((message, index) => ({
        ...message,
        sentAt: message.sentAt || 0,
        sourceKey: `${groupKey}-${index}`,
      })),
    ].sort((first, second) => first.sentAt - second.sentAt);
  };
  const getUnreadCount = (channel: string, caseId: string) => {
    const caseItem = cases.find(item => item.id === caseId);
    const key = channel === 'c' ? 'c' + caseId : caseItem ? internalConversationKey(caseItem) : 'i' + caseId;
    const thread = msgs[key] || [];
    const cursor = chatReadCursors[`${name}:${channel}:${caseId}`] || 0;
    return thread.slice(cursor).filter(message =>
      message.user !== name && !(isCro && message.role === 'CRO')
    ).length;
  };
  const getUnreadGroupCount = (groupPage: string) => {
    const company = companies.find(item => companyGroupPage(item) === groupPage);
    const city = cityGroups.find(item => cityGroupPage(item) === groupPage);
    if (!company && !city) return 0;
    const channel = company ? 'c' : 'i';
    const key = company ? clientGroupKey(company) : internalGroupKey(city!);
    const groupUnread = (msgs[key] || []).slice(chatReadCursors[`${name}:${key}`] || 0).filter(message =>
      message.user !== name && !(isCro && message.role === 'CRO')
    ).length;
    const caseUnread = chatCasesForPage(groupPage).reduce((count, caseItem) => count + getUnreadCount(channel, caseItem.id), 0);
    return groupUnread + caseUnread;
  };
  const internalUnreadCount =
    visible.reduce((count, caseItem) => count + getUnreadCount('i', caseItem.id), 0) +
    cityChatPages.reduce((count, groupPage) => count + getUnreadGroupCount(groupPage), 0);
  const openUnreadInternalChat = (fromDashboard = false) => {
    const firstUnreadCase = visible.find(caseItem => getUnreadCount('i', caseItem.id) > 0);
    const unreadGroup = cityChatPages.find(groupPage => getUnreadGroupCount(groupPage) > 0);
    const targetGroup = firstUnreadCase
      ? cityGroupPage(firstUnreadCase.city)
      : unreadGroup || cityGroupPage(isSupervisor ? sfsoCity : role === 'FSO' ? fsoCity : 'Islamabad');
    if (firstUnreadCase) setSelected(firstUnreadCase.id);
    go(targetGroup, fromDashboard);
  };

  // FSOs visible to the user:
  // SFSO only sees FSOs in their city!
  const visibleFSOs = officers.filter(o =>
    isSupervisor ? sfsoCityMatches(o.city, sfsoCity) : true
  );

  const visibleLogs = canViewAuditLogs ? logs : [];

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
    if (v.stage === 'Closed' && !isCro) {
      setNotice('Only a CRO can close a case.');
      return;
    }
    if (v.findings && !isCro) {
      setNotice('Only a CRO can add case findings.');
      return;
    }
    if (v.stage === 'Closed' && !current.findings?.some(finding => finding.kind !== 'classification' && finding.text.trim())) {
      setNotice('Add and save case findings before closing this case.');
      return;
    }
    if (v.report) {
      const key = internalConversationKey(c);
      setMsgs(all => ({
        ...all,
        [key]: [
          ...(all[key] || []),
          { user: name, role, text: 'Field report: ' + v.report, time: time(), caseId: c.id, sentAt: Date.now(), type: 'text' },
        ],
      }));
    }
    if (v.stage === 'Closed' && current.stage !== 'Closed') {
      const closureMessage: Msg = {
        user: 'Mohafiz Operations',
        role: 'CRO',
        text: `Case #${c.id} has been closed from our side.`,
        time: time(),
        caseId: c.id,
        sentAt: Date.now(),
        type: 'text',
      };
      const clientKey = clientGroupKey(c.co);
      const internalKey = internalConversationKey(c);
      setMsgs(all => ({
        ...all,
        [clientKey]: [...(all[clientKey] || []), closureMessage],
        [internalKey]: [...(all[internalKey] || []), closureMessage],
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
      sentAt: Date.now(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      [clientKey]: [...(all[clientKey] || []), autoAckMsg],
      [internalConversationKey(c)]: [...(all[internalConversationKey(c)] || []), autoAckMsg],
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
      `Reported unable to proceed by ${name}: escalated back to SFSO and SOM for reassignment`
    );

    const internalMsg: Msg = {
      user: `${name} (FSO)`,
      role: 'FSO',
      text: `⚠️ Field Officer ${name} reported unable to proceed with Case #${caseItem.id}: "${reason.trim()}". Case escalated back to SFSO and SOM for reassignment to another officer.`,
      time: time(),
      sentAt: Date.now(),
      type: 'text',
    };

    setMsgs(all => ({
      ...all,
      [internalConversationKey(caseItem)]: [...(all[internalConversationKey(caseItem)] || []), internalMsg],
    }));

    setBusyModalCase(null);
    setBusyReasonText('');
    setNotice(`Case #${caseItem.id} marked as unable to proceed and escalated to SFSO for reassignment.`);
  };

  // SFSO Assigns Case to Officer (Initial or Reassignment)
  const assignCaseBySfso = (caseItem: C, chosenOfficer: string, sfsoUnavailable = false) => {
    const eligibleOfficer = visibleFSOs.find(officer => officer.name === chosenOfficer);
    if ((!isSupervisor && !(isCro && sfsoUnavailable)) ||
        !(caseItem.stage === 'Escalated' || (isCro && caseItem.stage === 'New')) || !visible.some(item => item.id === caseItem.id) ||
        !eligibleOfficer || (isCro && eligibleOfficer.city !== caseItem.city)) {
      setNotice('Select an officer from your city desk before assigning this case.');
      return;
    }
    const workload = getFsoWorkload(chosenOfficer);
    const acknowledgement = caseItem.stage === 'New'
      ? { acknowledgedAt: time(), acknowledgedBy: `${name} (${role})` }
      : {};
    const internalKey = internalConversationKey(caseItem);
    const wasReassigned = Boolean(caseItem.busyReason);
    const reassignedNote = (isCro ? ' (SFSO unavailable; assigned by CRO)' : '') + (wasReassigned
      ? ` (Reassigned from ${caseItem.busyByOfficer || 'previous officer'} who reported unable to proceed)`
      : '');

    if (workload.isBusy) {
      const newQueueOrder = workload.queuedCount + 1;
      patch(
        caseItem,
        {
          officer: chosenOfficer,
          ...acknowledgement,
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
        user: `${name} (${role})`,
        role,
        text: `🚨 Case #${caseItem.id} assigned to Field Officer ${chosenOfficer} by ${role} ${name} (Queued Task #${newQueueOrder})${reassignedNote}. Priority: ${caseItem.priority}. Location: ${caseItem.exactLocation || caseItem.city}.`,
        time: time(),
        sentAt: Date.now(),
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
          ...acknowledgement,
          stage: 'In progress',
          isQueued: false,
          queueOrder: 0,
          fsoAcknowledged: false,
          accepted: false,
          busyReason: undefined,
          busyByOfficer: undefined,
          busyReportedAt: undefined,
        },
        `Assigned to ${chosenOfficer} by ${role} — Awaiting FSO Acknowledgement${reassignedNote}`
      );

      const internalMsg: Msg = {
        user: `${name} (${role})`,
        role,
        text: `🚨 Case #${caseItem.id} assigned to Field Officer ${chosenOfficer} by ${role} ${name} (Immediate Dispatch)${reassignedNote}. Location: ${caseItem.exactLocation || caseItem.city}.`,
        time: time(),
        sentAt: Date.now(),
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

  const filter = (k: string, label: string, values: string[], placeholder = false) =>
    placeholder ? (
      <label>
        <select aria-label={label} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })}>
          <option value="" disabled>{label}</option>
          <option value="All">All</option>
          {values.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    ) : select(label, ['All', ...values], f[k] || 'All', v => setF({ ...f, [k]: v }));

  const current = visible.find(c => c.id === selected) || visible[0];
  const pageLabel = (value: string) => value;
  const mobileNavPages = role === 'FSO' ? navPages.slice(0, 2) : navPages.slice(0, 4);

  // Send message or live location in chat
  const send = (channel: string, file?: File, liveLocation = false, targetCase?: C) => {
    const company = companies.find(item => companyGroupPage(item) === page);
    const city = cityGroups.find(item => cityGroupPage(item) === page);
    const key = targetCase
      ? channel === 'c' ? 'c' + targetCase.id : internalConversationKey(targetCase)
      : company
      ? clientGroupKey(company)
      : city
      ? internalGroupKey(city)
      : '';
    if (!key) return;

    if (liveLocation) {
      const locationCity = targetCase?.city || city || fsoCity;
      const locMsg: Msg = {
        user: name,
        role,
        text: `📍 Shared Live GPS Location${targetCase ? ` for Case #${targetCase.id}` : ''}`,
        time: time(),
        caseId: targetCase?.id,
        sentAt: Date.now(),
        type: 'location',
        location: {
          lat: locationCity === 'Rawalpindi' ? 33.6007 : locationCity === 'Karachi' ? 24.8607 : 31.5204,
          lng: locationCity === 'Rawalpindi' ? 73.0679 : locationCity === 'Karachi' ? 67.0011 : 74.3587,
          address: targetCase?.exactLocation || `${locationCity} incident zone`,
          accuracy: '±3m (High-Accuracy Real-Time GPS)',
        },
      };
      setMsgs(v => ({ ...v, [key]: [...(v[key] || []), locMsg] }));
      log('Shared live location', targetCase?.id || '—');
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
          caseId: targetCase?.id,
          sentAt: Date.now(),
          type: file ? 'file' : 'text',
        },
      ],
    }));
    setText('');
    log((channel === 'c' ? 'Client message sent: ' : 'Internal message sent: ') + (file ? 'Attachment: ' + file.name : text.trim()), targetCase?.id || '—');
  };

  useEffect(() => {
    if (!supabase) return;
    let recovering = new URLSearchParams(window.location.search).get('auth') === 'recovery';
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (demoActive.current) return;
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
        setPasswordRecovery(true);
        setSigned(false);
        return;
      }
      if (!session) {
        if (event === 'SIGNED_OUT') {
          recovering = false;
          setPasswordRecovery(false);
        }
        setSigned(false);
        setSignedInEmail('');
        setLiveProfile(null);
        return;
      }
      if (recovering) return;
      // Roles must be assigned by an administrator, never by editable user metadata.
      const access = session.user.app_metadata;
      const accountRole = typeof access.role === 'string' ? access.role : '';
      const city = access.city;
      const officer = officers.find(item => item.name === access.officer_name && item.city === city);
      const valid = Object.hasOwn(nav, accountRole) &&
        (!(accountRole === 'SFSO' || accountRole === 'SOM') || ['Islamabad', 'Lahore', 'Karachi'].includes(city)) &&
        (accountRole !== 'Client' || (typeof access.company === 'string' && !!access.company.trim())) &&
        (accountRole !== 'FSO' || (typeof access.officer_name === 'string' && !!access.officer_name.trim() && typeof city === 'string' && !!city.trim()));
      if (!valid) {
        setSigned(false);
        setAuthMessage('Your account needs an assigned role and coverage. Contact your administrator.');
        return;
      }
      setAuthMessage('');
      setLiveProfile({ role: accountRole, name: access.display_name || access.officer_name || accountRole, email: session.user.email || '', city: typeof city === 'string' ? city : '', company: typeof access.company === 'string' ? access.company : '', officerName: typeof access.officer_name === 'string' ? access.officer_name : '' });
      setDetail('');
      setRole(accountRole);
      if (accountRole === 'CRO' || accountRole === 'CRO Manager') setActiveCroName(access.display_name || accountRole);
      if (accountRole === 'Client') setCo(access.company);
      if (accountRole === 'SFSO' || accountRole === 'SOM') setSfsoCity(city);
      if (officer) setActiveFsoName(officer.name);
      setSignedInEmail(session.user.email || '');
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setPage(nav[accountRole][0]);
      setSigned(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const channel = companies.some(company => companyGroupPage(company) === page) ? 'c' : cityGroups.some(city => cityGroupPage(city) === page) ? 'i' : '';
    if (!signed || !channel) return;
    const groupCases = chatCasesForPage(page);
    const groupKey = channel === 'c'
      ? clientGroupKey(companies.find(company => companyGroupPage(company) === page)!)
      : internalGroupKey(cityGroups.find(city => cityGroupPage(city) === page)!);
    setChatReadCursors(previous => {
      const next = { ...previous };
      let changed = false;
      for (const caseItem of groupCases) {
        const cursorKey = `${name}:${channel}:${caseItem.id}`;
        const messageKey = channel === 'c' ? 'c' + caseItem.id : internalConversationKey(caseItem);
        const threadLength = (msgs[messageKey] || []).length;
        if (next[cursorKey] !== threadLength) {
          next[cursorKey] = threadLength;
          changed = true;
        }
      }
      const groupCursorKey = `${name}:${groupKey}`;
      const groupLength = (msgs[groupKey] || []).length;
      if (next[groupCursorKey] !== groupLength) {
        next[groupCursorKey] = groupLength;
        changed = true;
      }
      return changed ? next : previous;
    });
    const latestMessage = getGroupMessages(page).at(-1);
    if (latestMessage) {
      const viewer = role === 'SFSO'
        ? `${activeSfso.name} (SFSO)`
        : role === 'SOM'
        ? `SOM ${sfsoCity} (SOM)`
        : role === 'FSO'
        ? `${activeFsoName} (FSO)`
        : isCro
        ? `${activeCroName} (CRO)`
        : `${co} client`;
      const receiptKey = `${name}:${groupKey}`;
      setChatSeenReceipts(previous => {
        const existing = previous[receiptKey];
        const viewers = existing?.messageId === latestMessage.sourceKey
          ? existing.viewers
          : [];
        if (viewers.includes(viewer)) return previous;
        return { ...previous, [receiptKey]: { messageId: latestMessage.sourceKey, viewers: [...viewers, viewer] } };
      });
    }
  }, [page, name, msgs, signed]);

  useEffect(() => {
    if (!activeSearchMessage) return;
    document.getElementById(`chat-message-${encodeURIComponent(activeSearchMessage)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = window.setTimeout(() => setActiveSearchMessage(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [activeSearchMessage]);

  const chat = (channel: string) => {
    const casesInGroup = chatCasesForPage(page);
    const company = companies.find(item => companyGroupPage(item) === page);
    const city = cityGroups.find(item => cityGroupPage(item) === page);
    const groupKey = company ? clientGroupKey(company) : city ? internalGroupKey(city) : '';
    const messagesToShow = getGroupMessages(page);
    const latestMessage = messagesToShow.at(-1);
    const latestReceipt = chatSeenReceipts[`${name}:${groupKey}`];
    const latestViewers = latestMessage && latestReceipt?.messageId === latestMessage.sourceKey
      ? latestReceipt.viewers
      : [];
    const searchTerm = chatSearchQuery.trim().toLowerCase();
    const searchResults = searchTerm
      ? messagesToShow.filter(message => [
          message.text,
          message.user,
          message.caseId,
          message.location?.address,
        ].some(value => value?.toLowerCase().includes(searchTerm)))
      : [];

    return (
      <>
      {casesInGroup.length || (msgs[groupKey] || []).length ? (
        <section className="single-chat" aria-label={`${page} conversation`}>
          <header className="chat-thread-header">
            <div><b>{page}</b><small>All {casesInGroup.length} case conversations</small></div>
            <button
              type="button"
              className={'chat-search-toggle ' + (chatSearchOpen ? 'active' : '')}
              aria-label={chatSearchOpen ? 'Close chat search' : 'Search this chat'}
              title={chatSearchOpen ? 'Close chat search' : 'Search this chat'}
              aria-pressed={chatSearchOpen}
              onClick={() => {
                setChatSearchOpen(open => !open);
                setChatSearchQuery('');
                setActiveSearchMessage('');
              }}
            >
              {chatSearchOpen ? <X size={17} /> : <Search size={17} />}
            </button>
          </header>
          {chatSearchOpen && <div className="chat-search-bar">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search messages in this chat"
              placeholder="Search messages in this chat..."
              value={chatSearchQuery}
              onChange={event => setChatSearchQuery(event.target.value)}
            />
            {chatSearchQuery && <button type="button" className="chat-search-clear" aria-label="Clear search" onClick={() => setChatSearchQuery('')}><X size={15} /></button>}
          </div>}
          <div className={'chat-body ' + (chatSearchOpen && searchTerm ? 'with-search' : '')}>
          <div className="messages">
            {messagesToShow.map((m, i) => (
              <div
                id={`chat-message-${encodeURIComponent(m.sourceKey)}`}
                className={'message ' + (m.user === name ? 'me' : '') + (activeSearchMessage === m.sourceKey ? ' search-hit' : '')}
                key={m.sourceKey || `${m.user}-${i}`}
              >
                <small>
                  {m.role === 'CRO' && (role === 'Client' || channel === 'c')
                    ? 'Mohafiz Operations • Operations Desk'
                    : `${m.user} • ${m.role}`}{' '}
                  • {m.time}{m.caseId ? ` • Case ${m.caseId}` : ' • Group message'}
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
                {i === messagesToShow.length - 1 && latestViewers.length > 0 && (
                  <small className="message-seen-receipt">Seen by {latestViewers.join(', ')}</small>
                )}
              </div>
            ))}
            {!messagesToShow.length && <p className="sub">No messages yet in this group. Start the conversation or share real-time updates.</p>}
          </div>
          {chatSearchOpen && chatSearchQuery.trim() && <aside className="chat-search-results" aria-label="Search results">
            <div className="chat-search-results-heading">{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}</div>
            {searchResults.map(message => (
              <button type="button" key={message.sourceKey} className="chat-search-result" onClick={() => setActiveSearchMessage(message.sourceKey)}>
                <small>{message.time}{message.caseId ? ` · Case ${message.caseId}` : ' · Group message'}</small>
                <span><b>{message.user}</b> {message.text || message.location?.address || 'Location shared'}</span>
              </button>
            ))}
            {!searchResults.length && <p className="sub">No matching messages in this group.</p>}
          </aside>}
          </div>

          <form
            className="bar chat-composer"
            onSubmit={e => {
              e.preventDefault();
              send(channel);
            }}
          >
            <label className="upload chat-attach" aria-label="Attach documents, images, videos, or other files" title="Attach documents, images, videos, or other files">
              <Paperclip size={15} aria-hidden="true" />
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  Array.from(e.target.files || []).forEach(file => send(channel, file));
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className="chat-composer-icon"
              aria-label="Insert smile emoji"
              title="Insert smile emoji"
              onClick={() => setText(currentText => currentText + '🙂')}
            >
              <Smile size={19} aria-hidden="true" />
            </button>
            <input
              aria-label="Message"
              placeholder={`Message all cases in ${page}...`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {role === 'FSO' && (
              <button
                type="button"
                className="chat-composer-icon"
                aria-label="Share live location"
                title="Share live location to this city group"
                onClick={() => send(channel, undefined, true)}
              >
                <MapPin size={19} aria-hidden="true" />
              </button>
            )}
            <button className="primary chat-composer-send" type="submit" aria-label="Send message" title="Send message">
              <Send size={17} aria-hidden="true" />
            </button>
          </form>

        </section>
      ) : (
        <div className="empty">No cases are available in this group.</div>
      )}
    </>
    );
  };

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
  const [formCity, setFormCity] = useState('Rawalpindi');
  const [formHub, setFormHub] = useState('');
  const intakeCompany = role === 'Client' ? co : formCompany;
  const availableHubs = (clientHubs[intakeCompany] || []).filter(hub =>
    hub.includes(formCity) || (formCity === 'Rawalpindi' && hub.includes('Pindi'))
  );

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
          source: isCro ? String(d.get('source')) : 'Client Portal',
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
      </div>

      {isCro && (
        <label>
          Client Company
          <select
            name="co"
            required
            value={formCompany}
            onChange={e => { setFormCompany(e.target.value); setFormHub(''); }}
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
          Issue Type
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
          Priority
          <select name="priority" required defaultValue="Medium">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
      </div>

      {/* Row 2: City & Client Hub */}
      <div className="grid">
        <label>
          City
          <select name="city" required value={formCity} onChange={e => { setFormCity(e.target.value); setFormHub(''); }}>
            {cities.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          Who Raised Case (Client Hub / Branch)
          <select name="hub" required value={formHub} onChange={e => setFormHub(e.target.value)}>
            <option value="" disabled>Select a hub / branch</option>
            {availableHubs.map(h => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
            <option value="Other Hub">Other Hub / Custom Branch</option>
          </select>
          {availableHubs.length === 0 && <small>No listed hubs for this city. Choose Other Hub / Custom Branch.</small>}
        </label>
      </div>

      {formHub === 'Other Hub' && (
        <label>
          Custom Hub / Branch Name
          <input key={`${intakeCompany}-${formCity}`} name="customHub" required minLength={2} pattern=".*\S.*" placeholder="Enter the hub or branch name" />
        </label>
      )}

      {/* Row 3: Exact Location (Required by client) */}
      <label>
        Exact Location (Client-Reported Location / Landmark)
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
          Rider Name
          <input name="riderName" required minLength={2} placeholder="e.g. Muhammad Zeeshan" />
        </label>

        <label>
          Rider Contact Number
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
          Incident Time
          <input
            name="incidentTime"
            type="text"
            required
            placeholder="e.g. 14:30 or 02:30 PM"
            defaultValue="14:30"
          />
        </label>

        <label>
          Amount Involved (PKR)
          <input name="amount" type="number" min="1" required placeholder="e.g. 25000" defaultValue="15000" />
        </label>
      </div>

      {isCro && (
        <label>
          Intake Channel
          <select name="source" required defaultValue="Phone">
            <option>Phone Hotline</option>
            <option>Email Escalation</option>
            <option>Client Portal API</option>
            <option>Hub Walk-in</option>
          </select>
        </label>
      )}

      <label>
        What Happened (Incident Description)
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
    <div className={'desk ' + (!signed || light ? 'light' : '') + (signed && (role === 'FSO' || isSupervisor) ? ' mobile-portal' : '') + (signed && role === 'FSO' && page === 'My Cases' && !c ? ' fso-cases-page' : '') + (signed && (role === 'FSO' || isSupervisor) && cityChatPages.includes(page) && !c ? ' mobile-chat-page' : '')}>
      {/* Exact Location & Map Preview Modal */}
      {viewLocCase && (
        <div className="modal-overlay" onClick={() => setViewLocCase(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color="#246f68" />
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
                background: 'linear-gradient(135deg, #19353e, #2b5660)',
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
                    'radial-gradient(#70cbbb 1px, transparent 1px), radial-gradient(#70cbbb 1px, transparent 1px)',
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
                <small style={{ color: '#b9dcd0' }}>
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
                Explain why you are currently busy or working elsewhere and cannot take this dispatch. Your note will be recorded and the case will be escalated back to SFSO and SOM for immediate reassignment.
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
                Submit & Send to SFSO and SOM
              </button>
              <button type="button" onClick={() => setBusyModalCase(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Incident Resolution & Case Findings Report Modal */}
      {reportModalCase && !isSupervisor && (
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

            {/* Client reports show active follow-ups until the case is closed; CRO always sees both records. */}
            {(role !== 'Client' || reportModalCase.stage !== 'Closed') && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#246f68" />
                    <span>{role === 'Client' ? 'Case Progress Updates' : 'Follow-Up & Contact History'}</span>
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    {role === 'Client' ? 'Updates recorded by the CRO' : 'Internal operations log'}
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

            {/* Clients only see final findings after closure; CRO retains full report access. */}
            {(role !== 'Client' || reportModalCase.stage === 'Closed') && <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color="#246f68" />
                  <span>Official Investigation Findings & Resolution</span>
                </h3>
                <small style={{ color: 'var(--muted)' }}>
                  Recorded by Operations Desk prior to case closure
                </small>
              </div>

              {(role === 'Client'
                ? (reportModalCase.findings || []).filter(finding => finding.kind !== 'classification')
                : reportModalCase.findings || []
              ).length > 0 ? (
                (role === 'Client'
                  ? (reportModalCase.findings || []).filter(finding => finding.kind !== 'classification')
                  : reportModalCase.findings || []
                ).map((f, i) => (
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
            </div>}

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
        <AuthScreen recovery={passwordRecovery} message={authMessage} onRecovered={() => { setPasswordRecovery(false); window.history.replaceState({}, "", window.location.pathname); }}
          demoOptions={['CRO', 'CRO Manager', ...Object.keys(sfsoDesks).map(city => `SFSO ${city}`), ...Object.keys(sfsoDesks).map(city => `SOM ${city}`), ...officers.map(officer => `FSO ${officer.city} (${officer.name})`), ...companies.map(company => `Client ${company}`)]}
          onDemo={import.meta.env.DEV ? selection => {
            demoActive.current = true;
            setLiveProfile(null);
            let demoRole = selection;
            if (selection.startsWith('Client ')) {
              demoRole = 'Client'; setCo(selection.slice(7));
            } else if (selection.startsWith('SFSO ') || selection.startsWith('SOM ')) {
              demoRole = selection.startsWith('SFSO ') ? 'SFSO' : 'SOM';
              setSfsoCity(selection.slice(demoRole.length + 1) as 'Islamabad' | 'Lahore' | 'Karachi');
            } else if (selection.startsWith('FSO ')) {
              demoRole = 'FSO';
              const officer = officers.find(item => selection === `FSO ${item.city} (${item.name})`);
              if (officer) {
                setActiveFsoName(officer.name);
                setCases(current => restoreFsoDemoCases(current, officer));
                setFsoCaseFilter('all');
                setSelected(cases.find(item => item.officer === officer.name && item.stage === 'In progress')?.id || `DEMO-${officer.name.toUpperCase().replaceAll(' ', '-')}-ACTIVE`);
              }
            } else { setActiveCroName(selection); }
            setRole(demoRole);
            setPage(nav[demoRole][0]);
            setSignedInEmail('Demo mode');
            setAuthMessage(''); setNotice(''); setDetail(''); setIntake(false); setShowDashboardBack(false);
            setSigned(true);
          } : undefined}
        />
      ) : !demoActive.current ? (
        liveProfile ? <WorkbookPortal profile={liveProfile} light={light}
          onTheme={value => { setLight(value); try { localStorage.setItem('desk-theme', value ? 'light' : 'dark'); } catch {} }}
          onLogout={async () => {
            if (!supabase) throw new Error('Database connection is unavailable.');
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            setLiveProfile(null); setSigned(false); setDetail('');
          }} /> : <p role="status">Loading account?</p>
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
            <p className="workspace">Mohafiz</p>
            <nav>
              {navPages.map(p => {
                const Icon = pageIcons[p];
                const unreadCount = getUnreadGroupCount(p);
                return (
                  <button
                    key={p}
                    className={p === page || (p === 'Dashboard' && page === 'New Cases') ? 'active' : ''}
                    aria-current={p === page || (p === 'Dashboard' && page === 'New Cases') ? 'page' : undefined}
                    onClick={() => go(p)}
                  >
                    <span className="nav-icon">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="nav-label">{pageLabel(p)}</span>
                    {unreadCount > 0 && <span className="nav-unread-badge">{unreadCount > 4 ? '4+' : unreadCount}</span>}
                  </button>
                );
              })}
            </nav>
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

                {/* SOM stays on the city selected at sign-in. */}
                {role === 'SFSO' && demoActive.current && (
                  <span style={{ marginLeft: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <small style={{ color: 'var(--muted)', fontWeight: 600 }}>Switch City Desk:</small>
                    <select
                      value={sfsoCity}
                      onChange={e => {
                        const newCity = e.target.value as 'Islamabad' | 'Lahore' | 'Karachi';
                        setSfsoCity(newCity);
                        setNotice(`Switched to ${role} ${newCity} Desk. Showing ${newCity} cases & FSOs.`);
                      }}
                      style={{ height: 28, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}
                    >
                      <option value="Islamabad">Islamabad / Rawalpindi {role === 'SFSO' ? '(Ahmed)' : '(SOM)'}</option>
                      <option value="Lahore">Lahore {role === 'SFSO' ? '(Hamza)' : '(SOM)'}</option>
                      <option value="Karachi">Karachi {role === 'SFSO' ? '(Tariq)' : '(SOM)'}</option>
                    </select>
                  </span>
                )}

                {/* FSO Switcher when logged in as FSO */}
                {role === 'FSO' && (
                  <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="hub-tag" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                      📍 {fsoCity}
                    </span>
                  </span>
                )}
              </span>
            </div>
            <div className="header-controls">
                <details className="account-menu" onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                  }
                }}>
                  <summary className="header-avatar" aria-label="Open account options" title="Account">
                    <UserRound size={18} />
                  </summary>
                  <button className="account-menu-backdrop" type="button" tabIndex={-1} aria-label="Close account options" onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')} />
                  <div className="account-menu-panel">
                    <div className="account-profile">
                      <span className="account-profile-avatar"><UserRound size={36} strokeWidth={1.5} /></span>
                      <b className="account-profile-welcome">Welcome {name}</b>
                      {name !== role && <span className="account-profile-role">{role}</span>}
                      <small className="account-profile-email">{signedInEmail}</small>
                    </div>
                    <div className="account-menu-actions">
                    <button type="button" aria-expanded={accountSettingsOpen} onClick={() => setAccountSettingsOpen(value => !value)}><Settings size={18} />Account Settings</button>
                    {accountSettingsOpen && <div className="account-settings-fields">
                      <label>Email<input value={signedInEmail} readOnly /></label>
                      <label>Appearance<select value={light ? 'light' : 'dark'} onChange={event => {
                        const nextLight = event.target.value === 'light';
                        setLight(nextLight);
                        try { localStorage.setItem('desk-theme', nextLight ? 'light' : 'dark'); } catch {}
                      }}><option value="light">Light</option><option value="dark">Dark</option></select></label>
                    </div>}
                    <button type="button" onClick={event => {
                      event.currentTarget.closest('details')?.removeAttribute('open');
                      openUnreadInternalChat();
                    }}><Bell size={18} />Notifications{internalUnreadCount > 0 && <span className="account-notification-count">{internalUnreadCount}</span>}</button>
                    <button type="button" className="account-logout" onClick={async () => {
                      const wasDemo = demoActive.current;
                      demoActive.current = false;
                      if (supabase && !wasDemo) {
                        const { error } = await supabase.auth.signOut();
                        if (error) { setNotice(error.message); return; }
                      }
                      log('Signed out');
                      setSigned(false);
                      setSignedInEmail('');
                      setNotice('');
                      setMobileNavOpen(false);
                      setAccountSettingsOpen(false);
                    }}><LogOut size={16} />Log out</button>
                    </div>
                  </div>
                </details>
              </div>
            </header>

            <section className={c ? "content case-detail-content" : "content"}>
              <div className="heading">
                <div>
                  {(page !== 'New Cases' || c || intake) && <div className="eyebrow">
                    {c
                      ? 'CASE DETAILS'
                      : intake
                      ? 'INTAKE'
                      : page === 'Classification'
                      ? 'SECURITY • PENDING CLASSIFICATION'
                      : isSupervisor
                      ? `${role} ${sfsoCity.toUpperCase()} • ${categories[page]}`
                      : categories[page]}
                  </div>}
                  <h1>
                    {c
                      ? `Case ${c.id}`
                      : page === 'Classification'
                      ? 'Classify Incidents'
                      : isSupervisor && page === 'Escalations'
                      ? `Escalations — ${sfsoCity} Desk`
                      : pageLabel(page)}
                  </h1>
                </div>
                {isCro && showDashboardBack && page !== 'Dashboard' && page !== 'New Cases' && !c && !intake && (
                  <button type="button" className="back-to-dashboard" onClick={() => go('Dashboard')}>
                    Back to Dashboard
                  </button>
                )}
                {page === 'Classification' && !c && (
                  <button className="track-incidents" onClick={() => go('Case Board')}>
                    Track Incidents
                  </button>
                )}
                {page === 'New Cases' && (
                  <div className="actions">
                    {showDashboardBack && <button type="button" className="back-to-dashboard" onClick={() => go('Dashboard')}>Back to Dashboard</button>}
                    {!isCro && <button className="primary" onClick={() => setIntake(!intake)}>
                      {intake ? 'Cancel' : '+ Log a case'}
                    </button>}
                  </div>
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
                    {isCro && (
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
                            disabled={!c.findings?.some(finding => finding.kind !== 'classification' && finding.text.trim())}
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

                    {isCro && (c.stage === 'New' || c.stage === 'Escalated') && !c.isQueued && (
                      <form className="box" key={`cro-assign-${c.id}`} onSubmit={event => {
                        event.preventDefault();
                        const assignment = new FormData(event.currentTarget);
                        assignCaseBySfso(c, String(assignment.get('officer') || ''), assignment.get('sfsoUnavailable') === 'on');
                      }}>
                        <h3>Assign Field Officer</h3>
                        <div className="bar">
                          <label>FSO<select name="officer" required defaultValue="">
                            <option value="" disabled>Select FSO</option>
                            {visibleFSOs.filter(officer => officer.city === c.city).map(officer => {
                              const workload = getFsoWorkload(officer.name);
                              return <option key={officer.name} value={officer.name}>{officer.name} — {workload.isBusy ? 'Busy (assign to queue)' : 'Free'}</option>;
                            })}
                          </select></label>
                          <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="sfsoUnavailable" required style={{ width: 'auto' }} />SFSO is unavailable</label>
                          <button type="submit" className="primary" disabled={!visibleFSOs.some(officer => officer.city === c.city)}>Assign FSO</button>
                        </div>
                        {!visibleFSOs.some(officer => officer.city === c.city) && <small>No FSOs available for this city.</small>}
                      </form>
                    )}
                  <div className="field-service-layout">
                  <div className="box field-service-main">
                    <div className="service-title"><div><small>FIELD SERVICE ? {c.city}</small><h2>{c.issue} ? {c.riderName || c.co}</h2></div>{chip(c.stage)}</div>
                    <dl className="service-fields">{[['Project', 'Field Service'], ['Case ID', c.id], ['Category', c.issue], ['Customer', c.co], ['City', c.city], ['Hub', c.hub], ['Assigned to', c.officer || 'Unassigned'], ['Reported date', c.date], ['Contact', c.riderName], ['Incident time', c.incidentTime]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
                    <div className="service-tabs"><button type="button" aria-expanded="true" aria-controls="case-description">Description</button></div>
                    <section id="case-description" className="service-tab-content" aria-label="Description">
                    <p>{c.description || 'No description recorded.'}</p>
                    <div className="service-case-reference">{chip(c.priority)} {c.isQueued && <span className="queued-badge">Queued Task #{c.queueOrder || 1}</span>}</div>

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
                    {c.fieldReports?.length ? c.fieldReports.map(report => <EvidenceList key={report.id} report={report} />) : c.report && <p>Field report: {c.report}</p>}

                    </section>

                    {(isCro || isSupervisor) && (
                      <div className="bar" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
                          go(role === 'FSO' ? cityGroupPage(c.city) : companyGroupPage(c.co));
                        }}
                      >
                        Open Case Conversation →
                      </button>
                      {isCro && c.stage !== 'Closed' && (
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
                      {(role === 'Client' || (!isSupervisor && (c.stage === 'Closed' || (c.findings && c.findings.length > 0)))) && (
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
                          <FileText size={14} color="#246f68" />
                          <span>Generate / Print Case Report</span>
                        </button>
                      )}
                    </div>
                    {c.stage !== 'Closed' && !c.findings?.some(finding => finding.kind !== 'classification' && finding.text.trim()) && isCro && (
                      <p className="sub" style={{ color: '#d97706', fontWeight: 500 }}>
                        ⚠️ Case findings are compulsory before closing this case. Click "+ Add Findings" to record findings and attach files.
                      </p>
                    )}
                    {isCro && findingsCaseId === c.id && c.stage !== 'Closed' && (
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
                                  author: `${name} (${role})`,
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
                    {!isSupervisor && !!c.findings?.length && (
                      <section style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={16} color="#246f68" />
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
                            style={{ marginTop: 10, background: 'var(--soft)', borderLeft: '3px solid #246f68' }}
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
                  <section className="service-activity box" aria-label="Case notes and activity">
                    <div className="service-activity-actions"><button onClick={() => { setSelected(c.id); go(role === 'FSO' ? cityGroupPage(c.city) : companyGroupPage(c.co)); }}>Send message</button>{isCro && <button type="button" aria-expanded={inlineFollowUpCase === c.id} aria-controls="inline-follow-up" onClick={() => setInlineFollowUpCase(current => current === c.id ? '' : c.id)}>Log notes</button>}</div>
                    {isCro && inlineFollowUpCase === c.id && (
                      <section id="inline-follow-up" className="inline-follow-up log-note-composer" aria-label="Log an internal note">
                        <span className="note-avatar" aria-hidden="true"><UserRound size={18} /></span>
                        <FollowUpForm key={c.id} item={c} showClassification noteMode onClassificationChange={classification => {
                          if (classification === c.cls) return;
                          patch(c, {
                            cls: classification,
                            findings: [...(c.findings || []).filter(finding => finding.kind !== 'classification'), {
                              kind: 'classification',
                              text: `Classification: ${classification}`,
                              author: `${name} (${role})`,
                              at: new Date().toISOString(),
                            }],
                          }, 'Classification saved to findings: ' + classification);
                          setNotice('Classification saved automatically to Findings.');
                        }} save={(item, followUp, classification) => {
                          patch(item, { followUps: [...(item.followUps || []), { ...followUp, author: name }], cls: classification ?? item.cls }, 'Internal note logged');
                          setNotice('Note and classification saved.');
                        }} />
                      </section>
                    )}
                    <h3>Case activity</h3>
                    {canViewAuditLogs && visibleLogs.filter(entry => entry.id === c.id).length === 0 && <p className="sub">No activity recorded yet.</p>}
                    {visibleLogs.filter(entry => entry.id === c.id).map((entry, index) => <article className="service-event" key={entry.at + '-' + index}><small>{entry.time}</small><b>{entry.user}</b><p>{entry.action}</p></article>)}
                    {(c.followUps || []).map((entry, index) => <article className="service-event" key={'follow-' + index}><small>{new Date(entry.at).toLocaleString()}</small><b>{entry.author}</b><p>{entry.text}</p>{entry.attachments?.map((file, index) => <a className="service-evidence" key={index} href={file.url} download={file.name}>{file.kind}: {file.name}</a>)}</article>)}
                  </section>
                  </div>
                </>
              ) : intake || page === 'Raise a Case' ? (
                intakeForm
              ) : (
                <>
                  {/* Dashboard and follow-ups */}
                  {page === 'Follow-Ups / Findings' && canManageFollowUps && (
                    <FollowUps
                      cases={visible.filter(c => c.stage !== 'Closed')}
                      open={setDetail}
                      canLogNotes
                      save={(item, followUp) => {
                        patch(
                          item,
                          { followUps: [...(item.followUps || []), { ...followUp, author: name }] },
                          'Case follow-up saved'
                        );
                      }}
                    />
                  )}
                  {page === 'Dashboard' && (
                    <>
                      <div className="stats">
                        <button className="stat" onClick={() => go('New Cases', true)}>
                          <span>To acknowledge</span>
                          <b>{cases.filter(c => c.stage === 'New').length}</b>
                        </button>
                        <button className="stat" onClick={() => { setBoardCity(''); setBoardStatus('Pending'); go('Case Board', true); }}>
                          <span>Pending cases</span>
                          <b>{cases.filter(c => c.stage !== 'Closed' && (c.isQueued || c.stage !== 'In progress')).length}</b>
                        </button>
                        <button className="stat" onClick={() => openUnreadInternalChat(true)}>
                          <span>Updates to review</span>
                          <b>{internalUnreadCount}</b>
                        </button>
                        <button className="stat" onClick={() => go('Case Board', true)}>
                          <span>In progress</span>
                          <b>{cases.filter(c => c.stage === 'In progress').length}</b>
                        </button>
                        <button className="stat" onClick={() => go('Case Board', true)}>
                          <span>Closed cases</span>
                          <b>{cases.filter(c => c.stage === 'Closed').length}</b>
                        </button>
                      </div>

                      <div className="box next">
                        <div>
                          <div className="eyebrow">CRO ACTION DESK</div>
                          <h2>{cases.filter(c => c.stage === 'New').length} New Cases Pending Review</h2>
                        </div>
                        <button className="primary new-cases-button" onClick={() => go('New Cases', true)}>
                          New Cases
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
                      <div className="tw">
                        <table className="new-cases-table">
                          <thead>
                            <tr>
                              <th colSpan={7} className="new-cases-filter-cell">
                                <div className="new-cases-filters">
                                  <label className="new-cases-search">
                                    <span className="sr-only">Search Case ID</span>
                                    <input type="search" placeholder="Search by Case ID..." value={f.search || ''} onChange={event => setF(values => ({ ...values, search: event.target.value }))} />
                                  </label>
                                  {filter('co', 'Company', companies, true)}
                                  {filter('city', 'City', cities, true)}
                                  {filter('priority', 'Priority', ['High', 'Medium', 'Low'], true)}
                                </div>
                              </th>
                            </tr>
                            <tr>
                              <th>Case ID</th>
                              <th>Company & Hub</th>
                              <th>City</th>
                              <th>Issue</th>
                              <th>Exact Location</th>
                              <th>Priority</th>
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
                                  <td>
                                    <div className="actions">
                                      {/* Only Primary Acknowledge and Send to SFSO */}
                                      <button
                                        className="primary"
                                        style={{ fontSize: 11, padding: '6px 12px' }}
                                        onClick={() => acknowledgeCaseToSfso(c)}
                                        title={`Acknowledge case: auto-sends ID to client and dispatches to SFSO ${c.city}`}
                                      >
                                        Acknowledge
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
                                  (visibleFSOs.some(officer => officer.name === c.officer) ? c.officer : '') ||
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
                                              background: 'var(--button)',
                                              borderColor: 'var(--button)',
                                              color: '#ffffff',
                                              fontSize: 11,
                                            }}
                                            onClick={() => assignCaseBySfso(c, selectedOfficer)}
                                            title="Officer is currently busy: place in their queue"
                                          >
                                            Assign as Queued Case (Next in line)
                                          </button>
                                          <small style={{ color: '#826c45', fontSize: 10 }}>
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
                      <div className="city-board-filters">
                        <label><span className="sr-only">City</span><select value={boardCity} onChange={e => setBoardCity(e.target.value)}><option value="" disabled hidden>City</option>{Array.from(new Set(visible.map(item => item.city))).sort().map(city => <option key={city}>{city}</option>)}</select></label>
                        <label><span className="sr-only">Status</span><select value={boardStatus} onChange={e => setBoardStatus(e.target.value)}><option value="" disabled hidden>Status</option>{['Open', 'Pending', 'Closed', 'Hold', 'In progress'].map(status => <option key={status}>{status}</option>)}</select></label>
                      </div>
                      <div className="board city-board">
                        {Array.from(new Set(visible.map(item => item.city))).sort().filter(city => !boardCity || city === boardCity).map(city => {
                          const cityCases = visible.filter(item => item.city === city && (!boardStatus || (boardStatus === 'Open' ? item.stage !== 'Closed' : boardStatus === 'Pending' ? item.stage !== 'Closed' && (item.isQueued || item.stage !== 'In progress') : item.stage === boardStatus)));
                          return (
                          <section className="column" key={city}>
                            <h3>
                              {city}
                              <span>{cityCases.length}</span>
                            </h3>
                            {cityCases.length === 0 && <p className="city-empty">No cases match this status.</p>}
                            {cityCases.map(c => (
                                <button
                                  className="card"
                                  key={c.id}
                                  onClick={() => { setDetail(c.id); setInlineFollowUpCase(''); log('Opened case', c.id); }}
                                >
                                  <div>
                                    {chip(c.co)}
                                    {chip(c.priority)}
                                    {chip(c.stage)}
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
                        ); })}
                      </div>
                    </>
                  )}

                  {/* Page: Client Updates / Internal Case Group / Case Group */}
                  {chatPages.includes(page) &&
                    chat(companies.some(company => companyGroupPage(company) === page) ? 'c' : 'i')}

                  {/* Page: Classification (CRO) */}
                  {page === 'Classification' && isCro && (
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
                      {/* Clickable KPI filter cards for Client */}
                      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <button
                          type="button"
                          className={`stat ${clientKpiFilter === 'open' ? 'active-kpi' : ''}`}
                          onClick={() => setClientKpiFilter(prev => prev === 'open' ? 'all' : 'open')}
                          title="Click to filter only open/active cases"
                          style={{
                            border: clientKpiFilter === 'open' ? '2px solid #246f68' : '1px solid var(--border)',
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
                        <table className="client-cases-table">
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
                                    <span className="client-case-hub">{c.hub || 'Central Hub'}</span>
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
                                    <div className="client-workflow">
                                      <span className={`client-workflow-text ${c.stage === 'Closed' ? 'resolved' : c.stage === 'New' || c.stage === 'Hold' || c.isQueued || c.stage === 'Escalated' ? 'waiting' : 'active'}`}>
                                        {c.stage === 'Closed' ? 'Resolved & Closed'
                                          : c.stage === 'New' ? 'Received — Awaiting CRO Acknowledgement'
                                          : c.stage === 'Hold' ? 'On Hold'
                                          : c.isQueued ? `Queued for Field Team${c.officer ? ` (${c.officer})` : ''}`
                                          : c.stage === 'Escalated' ? 'Awaiting Field Officer Assignment'
                                          : c.stage === 'In progress' ? `Dispatched to Field Team${c.officer ? ` (${c.officer})` : ''}`
                                          : c.stage}
                                      </span>
                                      {(c.stage === 'Closed' || !!c.findings?.length) && <button
                                        type="button"
                                        className="client-report-link"
                                        onClick={() => setReportModalCase(c)}
                                        title="View official resolution report"
                                      ><FileText size={12} /><span>View Report</span></button>}
                                    </div>
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

                  {/* Page: FSO mobile workspace */}
                  {page === 'My Cases' && role === 'FSO' && <FsoWorkspace
                    cases={visible}
                    officer={activeOfficer}
                    filter={fsoCaseFilter}
                    onFilter={setFsoCaseFilter}
                    onMap={setViewLocCase}
                    onChat={item => { setSelected(item.id); go(cityGroupPage(item.city)); }}
                    onAcknowledge={handleFsoAcknowledge}
                    onArrive={item => patch(item, { arrived: true }, 'Arrival confirmed (Simulated GPS)')}
                    onReport={async (item, text, files, progress) => {
                      const current = cases.find(candidate => candidate.id === item.id);
                      if (role !== 'FSO' || !current || current.officer !== name || !current.arrived || current.stage !== 'In progress') throw new Error('You can submit reports only for your active case after arrival.');
                      if (text.trim().length < 20 || files.length > MAX_ATTACHMENTS || files.some(file => !evidenceKind(file.type) || !file.size || file.size > EVIDENCE_LIMIT)) throw new Error('Check the report text and attachment limits.');
                      let submission: FieldSubmission;
                      if (demoActive.current) {
                        submission = { id: crypto.randomUUID(), text, author: name, at: new Date().toISOString(), demo: true,
                          attachments: files.map(file => {
                            const url = URL.createObjectURL(file); demoEvidenceUrls.current.add(url);
                            return { id: crypto.randomUUID(), name: file.name, kind: evidenceKind(file.type)!, type: file.type, size: file.size, url };
                          }) };
                      } else {
                        submission = await persistFieldReport(current.sourceRecord, text, files, progress);
                      }
                      patch(current, { report: text, fieldReports: [...(current.fieldReports || []), submission] }, 'Field report submitted' + (files.length ? ` with ${files.length} evidence attachments` : ''));
                      return submission;
                    }}
                    onBusy={item => { setBusyModalCase(item); setBusyReasonText(''); }}
                    onStartQueued={item => patch(item, { isQueued: false, stage: 'In progress', accepted: true }, 'Started next queued case: ' + item.id)}
                  />}

                  {/* Page: Reports */}
                  {page === 'Reports' && (
                    <div className="reports-page">
                      <div className="bar reports-filters" style={{ '--report-filter-count': 5 + Number(role !== 'Client') + Number(!isSupervisor) } as React.CSSProperties}>
                        <div className="reports-filter-toolbar">
                          <span>From</span>
                          <span>To</span>
                          <div className="reports-filter-actions">
                            <button className="reports-reset" type="button" aria-label="Reset report filters" title="Reset filters" onClick={() => setF({})}><RotateCcw size={16} /></button>
                            <button className="primary reports-export" onClick={exportCsv}>Export CSV</button>
                          </div>
                        </div>
                        <label>
                          <span className="sr-only">From</span>
                          <input
                            type="date"
                            value={f.from || ''}
                            onChange={e => setF({ ...f, from: e.target.value })}
                          />
                        </label>
                        <label>
                          <span className="sr-only">To</span>
                          <input
                            type="date"
                            value={f.to || ''}
                            min={f.from}
                            onChange={e => setF({ ...f, to: e.target.value })}
                          />
                        </label>
                        {role !== 'Client' && filter('co', 'Company', companies, true)}
                        {!isSupervisor && filter('city', 'City', cities, true)}
                        {filter('stage', 'Status', stages, true)}
                        {filter('cls', 'Classification', ['Genuine', 'Negligence', 'Fraud'], true)}
                        <label>
                          <span className="sr-only">Case ID</span>
                          <input
                            placeholder="Search ID..."
                            value={f.search || ''}
                            onChange={e => setF({ ...f, search: e.target.value })}
                          />
                        </label>
                      </div>

                      <div className="stats reports-stats">
                        <div className="stat report-total">
                          <span>Total Cases</span>
                          <b>{filtered.length}</b>
                          <small>Filtered records</small>
                        </div>
                        <div className="stat report-exposure">
                          <span>Total Exposure (PKR)</span>
                          <b>{filtered.reduce((n, c) => n + c.amount, 0).toLocaleString()}</b>
                          <small>Reported exposure</small>
                        </div>
                        <div className="stat report-recovered">
                          <span>Recovered (PKR)</span>
                          <b>{filtered.reduce((n, c) => n + c.recovered, 0).toLocaleString()}</b>
                          <small>Recovered amount</small>
                        </div>
                      </div>

                      <div className="tw reports-table-wrap">
                        <table className="reports-table">
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
                                  <button type="button" className="link report-case-link" onClick={() => {
                                    setDetail(c.id);
                                    log('Opened case', c.id);
                                  }}><b>{c.id}</b></button>
                                  <small>{c.date}</small>
                                </td>
                                <td>
                                  <div className="co-hub-cell">
                                    <b>{c.co}</b>
                                    <small className="report-hub">{c.hub || 'Central Hub'}</small>
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
                                    className="report-generate-icon"
                                    aria-label={`Generate report for ${c.id}`}
                                    onClick={() => setReportModalCase(c)}
                                    title="Generate and print official incident resolution report including findings"
                                  >
                                    <FileText size={17} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!filtered.length && <div className="empty">No matching records found.</div>}
                      </div>
                    </div>
                  )}

                  {/* Page: Audit Logs */}
                  {page === 'Audit Logs' && canViewAuditLogs && (
                    <>
                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>User & Role</th>
                              <th>Activity Performed</th>
                              <th>Case ID</th>
                              <th>Timestamp</th>
                              <th>Since previous case activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleLogs.map((l, i) => (
                              <tr key={i}>
                                <td>
                                  <b>{l.user}</b>
                                </td>
                                <td>{l.action}</td>
                                <td>{l.id}</td>
                                <td>{l.time}</td>
                                <td>{(() => {
                                  const previous = logs.find(entry => entry.id === l.id && entry.at < l.at);
                                  if (!previous || !cases.some(c => c.id === l.id)) return 'First activity';
                                  const seconds = Math.floor((l.at - previous.at) / 1000);
                                  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
                                })()}</td>
                              </tr>
                            ))}
                            {!visibleLogs.length && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
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
          </main>

          {/* Mobile Bottom Quick-Access Thumb Bar (Visible on mobile screens only) */}
          <nav className="mobile-bottom-bar" aria-label="Mobile Navigation Bar">
            {mobileNavPages.map(p => {
              const Icon = pageIcons[p];
              const unreadCount = getUnreadGroupCount(p);
              return (
                <button
                  key={p}
                  type="button"
                  className={'mobile-bottom-item ' + (p === page || (p === 'Dashboard' && page === 'New Cases') ? 'active' : '')}
                  onClick={() => go(p)}
                  aria-label={p}
                >
                  <Icon size={18} />
                  <span>{cityChatPages.includes(p) ? 'City Chat' : pageLabel(p)}</span>
                  {unreadCount > 0 && <span className="mobile-unread-badge">{unreadCount > 4 ? '4+' : unreadCount}</span>}
                </button>
              );
            })}
            {role !== 'FSO' && <button
              type="button"
              className={'mobile-bottom-item ' + (mobileNavOpen ? 'active' : '')}
              onClick={() => setMobileNavOpen(true)}
              aria-label="All Navigation Pages"
            >
              <Menu size={18} />
              <span>Menu</span>
            </button>}
          </nav>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
