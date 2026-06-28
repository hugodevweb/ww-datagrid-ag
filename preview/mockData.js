// Mock data for the standalone preview. Nothing here talks to a backend —
// the Record column is fed by a fake Supabase client defined below, and every
// avatar / image is a generated SVG data-URI, so the preview is 100% offline.

// --- Users (consumed by UserCellRenderer via cellRendererParams.users) -------
// No avatar_url is set, so the renderer falls back to its built-in coloured
// initials avatar — fully offline, no image requests.
export const USERS = [
  { id: 'u1', name: 'Maya Chen',     email: 'maya@acme.io',   bio: 'Product Lead',        phone_number: '+33 6 12 34 56 78' },
  { id: 'u2', name: 'Liam Patel',    email: 'liam@acme.io',   bio: 'Frontend Engineer',   phone_number: '+33 6 22 33 44 55' },
  { id: 'u3', name: 'Sofia Rossi',   email: 'sofia@acme.io',  bio: 'Designer',            phone_number: '+33 6 33 44 55 66' },
  { id: 'u4', name: 'Noah Williams', email: 'noah@acme.io',   bio: 'Backend Engineer',    phone_number: '+33 6 44 55 66 77' },
  { id: 'u5', name: 'Aisha Khan',    email: 'aisha@acme.io',  bio: 'QA & Support',        phone_number: '+33 6 55 66 77 88' },
  { id: 'u6', name: 'Tom Becker',    email: 'tom@acme.io',    bio: 'DevOps',              phone_number: '+33 6 66 77 88 99' },
];

// --- Select options (consumed by SelectCellRenderer) -------------------------
export const STATUS_OPTIONS = [
  { value: 'planned',  label: 'Planned',     color: '#6366f1' },
  { value: 'progress', label: 'In progress', color: '#f59e0b' },
  { value: 'blocked',  label: 'Blocked',     color: '#ef4444' },
  { value: 'done',     label: 'Done',        color: '#10b981' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#0ea5e9' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#ef4444' },
];

// Quick lookup helpers reused across all three views.
export const statusOption   = (v) => STATUS_OPTIONS.find((o) => o.value === v);
export const priorityOption = (v) => PRIORITY_OPTIONS.find((o) => o.value === v);
export const userById       = (id) => USERS.find((u) => u.id === id);
export const companyById     = (id) => COMPANIES.find((c) => c.id === id);

// --- Records (consumed by RecordCellRenderer through the fake Supabase) -------
export const COMPANIES = [
  { id: 'c1', name: 'Northwind Trading', industry: 'Logistics',  city: 'Lyon',     employees: 240 },
  { id: 'c2', name: 'Helios Energy',     industry: 'Energy',     city: 'Paris',    employees: 1200 },
  { id: 'c3', name: 'BlueLeaf Studio',   industry: 'Design',     city: 'Bordeaux', employees: 18 },
  { id: 'c4', name: 'Quantic Labs',      industry: 'Software',   city: 'Nantes',   employees: 95 },
  { id: 'c5', name: 'Maison Vert',       industry: 'Retail',     city: 'Lille',    employees: 60 },
];

// Fake Supabase client. RecordCellRenderer calls:
//   supabase.from(table).select(str).limit(100)  →  awaited → { data, error }
export const mockSupabase = {
  from() {
    return {
      select() { return this; },
      limit() { return Promise.resolve({ data: COMPANIES, error: null }); },
    };
  },
};

// --- Cover thumbnails (image column type) ------------------------------------
// Deterministic gradient SVG data-URI per project — demonstrates the "image"
// column type without any network request.
const COVER_PALETTE = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#06b6d4'], ['#f59e0b', '#ef4444'],
  ['#10b981', '#14b8a6'], ['#ec4899', '#f43f5e'], ['#8b5cf6', '#6366f1'],
];
export function coverFor(seed) {
  const [a, b] = COVER_PALETTE[seed % COVER_PALETTE.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>` +
    `</linearGradient></defs>` +
    `<rect width='40' height='40' rx='8' fill='url(%23g)'/></svg>`;
  return `data:image/svg+xml,${svg.replace(/#/g, '%23')}`;
}

// --- Rows --------------------------------------------------------------------
// Each row exercises every column type: text (project), image (cover),
// user (assignees), select (status / priority), record (company_id),
// dateString (due), number (progress) and currency (budget) + boolean (billable).
export const ROWS = [
  { id: 1,  project: 'Acme Onboarding',     cover: coverFor(1),  assignees: ['u1', 'u3'],       status: 'progress', priority: 'high',   company_id: 'c1', due: '2026-07-10', progress: 62,  budget: 18500, billable: true  },
  { id: 2,  project: 'Website Redesign',    cover: coverFor(2),  assignees: ['u2'],             status: 'progress', priority: 'medium', company_id: 'c3', due: '2026-08-02', progress: 41,  budget: 32000, billable: true  },
  { id: 3,  project: 'Q3 Marketing Push',   cover: coverFor(3),  assignees: ['u3', 'u5'],       status: 'planned',  priority: 'low',    company_id: 'c5', due: '2026-07-15', progress: 8,   budget: 12000, billable: false },
  { id: 4,  project: 'Mobile App v2',       cover: coverFor(4),  assignees: ['u4', 'u2', 'u6'], status: 'blocked',  priority: 'high',   company_id: 'c4', due: '2026-07-28', progress: 27,  budget: 56000, billable: true  },
  { id: 5,  project: 'Data Migration',      cover: coverFor(5),  assignees: ['u1'],             status: 'done',     priority: 'medium', company_id: 'c2', due: '2026-07-01', progress: 100, budget: 9400,  billable: false },
  { id: 6,  project: 'Customer Portal',     cover: coverFor(6),  assignees: ['u5', 'u1'],       status: 'progress', priority: 'high',   company_id: 'c1', due: '2026-07-19', progress: 73,  budget: 41000, billable: true  },
  { id: 7,  project: 'Billing Integration', cover: coverFor(7),  assignees: ['u2', 'u4'],       status: 'planned',  priority: 'medium', company_id: 'c4', due: '2026-07-05', progress: 0,   budget: 22000, billable: true  },
  { id: 8,  project: 'Security Audit',      cover: coverFor(8),  assignees: ['u4'],             status: 'done',     priority: 'high',   company_id: 'c2', due: '2026-07-20', progress: 100, budget: 15000, billable: false },
  { id: 9,  project: 'Analytics Dashboard', cover: coverFor(9),  assignees: ['u3'],             status: 'progress', priority: 'low',    company_id: 'c3', due: '2026-07-22', progress: 55,  budget: 27500, billable: true  },
  { id: 10, project: 'API Rate Limiting',   cover: coverFor(10), assignees: ['u6', 'u5'],       status: 'blocked',  priority: 'medium', company_id: 'c4', due: '2026-07-14', progress: 33,  budget: 8000,  billable: true  },
  { id: 11, project: 'Design System',       cover: coverFor(11), assignees: ['u3', 'u2'],       status: 'progress', priority: 'medium', company_id: 'c3', due: '2026-07-26', progress: 48,  budget: 19000, billable: true  },
  { id: 12, project: 'Payment Gateway',     cover: coverFor(12), assignees: ['u4', 'u1'],       status: 'planned',  priority: 'high',   company_id: 'c2', due: '2026-07-30', progress: 0,   budget: 38000, billable: false },
];
