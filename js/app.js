// ============================================================
//  SmartLab – Core Application State & Auth
// ============================================================

const SmartLab = (() => {

  /* ---------- Credentials ---------- */
  const USERS = [
    {
      id: 'U001', role: 'student',
      email: 'student@smartlab.edu',
      password: 'student123',
      name: 'Alex Johnson', department: 'Computer Science', year: '3rd Year'
    },
    {
      id: 'A001', role: 'admin',
      email: 'admin@smartlab.edu',
      password: 'admin@SL2026',
      name: 'Dr. Priya Sharma', department: 'Lab Management', title: 'Lab Administrator'
    }
  ];

  /* ---------- Initial Data ---------- */
  const INITIAL_WORKSTATIONS = Array.from({ length: 24 }, (_, i) => ({
    id: `WS-${String(i + 1).padStart(3, '0')}`,
    row: Math.floor(i / 6) + 1, col: (i % 6) + 1,
    status: ['available','available','available','reserved','checkedin','outofsvc'][Math.floor(Math.random() * 6)] || 'available',
    assets: {
      computer:  `PC-${String(i+1).padStart(3,'0')}`,
      monitor:   `MON-${String(i+1).padStart(3,'0')}`,
      keyboard:  `KB-${String(i+1).padStart(3,'0')}`,
      mouse:     `MS-${String(i+1).padStart(3,'0')}`,
      desk:      `DSK-${String(i+1).padStart(3,'0')}`,
      chair:     `CHR-${String(i+1).padStart(3,'0')}`
    },
    qrCode: `SL-QR-${String(i+1).padStart(3,'0')}`
  }));
  // Set some deterministic statuses
  INITIAL_WORKSTATIONS[0].status = 'available';
  INITIAL_WORKSTATIONS[1].status = 'reserved';
  INITIAL_WORKSTATIONS[2].status = 'checkedin';
  INITIAL_WORKSTATIONS[3].status = 'outofsvc';
  INITIAL_WORKSTATIONS[4].status = 'available';
  INITIAL_WORKSTATIONS[5].status = 'reserved';

  /* ---------- State ---------- */
  let state = {
    currentUser: null,
    workstations: [...INITIAL_WORKSTATIONS],
    reservations: [
      { id:'R001', userId:'U001', wsId:'WS-002', date:'2026-11-25', slot:'10:00–12:00', status:'active', createdAt:'2026-11-25T08:00:00' },
      { id:'R002', userId:'U001', wsId:'WS-006', date:'2026-11-26', slot:'14:00–16:00', status:'active', createdAt:'2026-11-25T09:00:00' },
      { id:'R003', userId:'A001', wsId:'WS-010', date:'2026-11-25', slot:'09:00–11:00', status:'completed', createdAt:'2026-11-24T07:00:00' },
    ],
    checkIns: [
      { id:'CI001', userId:'U001', wsId:'WS-003', reservationId:'R001', checkinAt:'2026-11-25T10:05:00', checkoutAt:null }
    ],
    faultReports: [
      { id:'FR001', wsId:'WS-004', userId:'U001', description:'Monitor flickering, screen artifacts visible', status:'open', severity:'high', createdAt:'2026-11-24T14:00:00' },
      { id:'FR002', wsId:'WS-010', userId:'A001', description:'Keyboard key stuck – F5 unresponsive', status:'resolved', severity:'low', createdAt:'2026-11-23T10:00:00' },
    ],
    maintenanceRecords: [
      { id:'MR001', wsId:'WS-004', technicianId:'A001', action:'Screen replacement ordered', status:'in_progress', scheduledAt:'2026-11-26T09:00:00' },
    ],
    announcements: [
      { id:'AN001', title:'Lab hours extended this week', body:'SmartLab will be open until 10 PM Mon–Fri this week due to exam period.', date:'2026-11-24', author:'Dr. Priya Sharma' },
      { id:'AN002', title:'Scheduled maintenance – WS-004 and WS-004', body:'Workstations 4 will be offline for maintenance on Nov 26.', date:'2026-11-25', author:'Admin' },
    ],
    notifications: [
      { id:'N001', userId:'U001', message:'Your reservation for WS-002 is confirmed.', read: false, time:'2026-11-25T08:01:00' },
      { id:'N002', userId:'U001', message:'Check-in window for WS-003 opens in 15 minutes.', read: false, time:'2026-11-25T09:45:00' },
    ],
    auditLog: [
      { id:'AL001', userId:'U001', action:'LOGIN', detail:'Student login', time:'2026-11-25T08:00:00' },
    ]
  };

  /* ---------- Auth ---------- */
  function login(email, password) {
    const u = USERS.find(u => u.email === email && u.password === password);
    if (!u) return null;
    state.currentUser = u;
    sessionStorage.setItem('sl_user', JSON.stringify(u));
    addAuditLog(u.id, 'LOGIN', `${u.role} login`);
    return u;
  }
  function logout() {
    addAuditLog(state.currentUser?.id, 'LOGOUT', 'Session ended');
    state.currentUser = null;
    sessionStorage.removeItem('sl_user');
    window.location.href = '/index.html';
  }
  function restoreSession() {
    const saved = sessionStorage.getItem('sl_user');
    if (saved) state.currentUser = JSON.parse(saved);
    return state.currentUser;
  }
  function requireAuth(requiredRole) {
    const u = restoreSession();
    if (!u) { window.location.href = '/index.html'; return null; }
    if (requiredRole && u.role !== requiredRole) { window.location.href = '/index.html'; return null; }
    return u;
  }

  /* ---------- Workstation helpers ---------- */
  function getWorkstation(id) { return state.workstations.find(w => w.id === id); }
  function updateWsStatus(id, status) {
    const ws = getWorkstation(id);
    if (ws) { ws.status = status; addAuditLog(state.currentUser?.id, 'WS_STATUS', `${id} → ${status}`); }
  }

  /* ---------- Reservation helpers ---------- */
  function createReservation(userId, wsId, date, slot) {
    const conflicts = state.reservations.filter(
      r => r.wsId === wsId && r.date === date && r.slot === slot && r.status === 'active'
    );
    if (conflicts.length) return { error: 'This slot is already reserved. Please choose another.' };
    const ws = getWorkstation(wsId);
    if (!ws || ws.status === 'outofsvc') return { error: 'Workstation is out of service.' };

    const id = 'R' + Date.now();
    const res = { id, userId, wsId, date, slot, status:'active', createdAt: new Date().toISOString() };
    state.reservations.push(res);
    updateWsStatus(wsId, 'reserved');
    addNotification(userId, `Reservation ${id} confirmed for ${wsId} on ${date} ${slot}.`);
    addAuditLog(userId, 'RESERVE', `${wsId} on ${date} ${slot}`);
    return { success: true, reservation: res };
  }

  function cancelReservation(resId) {
    const r = state.reservations.find(r => r.id === resId);
    if (!r) return { error: 'Reservation not found.' };
    r.status = 'cancelled';
    updateWsStatus(r.wsId, 'available');
    addAuditLog(state.currentUser?.id, 'CANCEL', `Reservation ${resId}`);
    return { success: true };
  }

  /* ---------- Check-in / out ---------- */
  function checkIn(qrCode) {
    const ws = state.workstations.find(w => w.qrCode === qrCode);
    if (!ws) return { error: 'Invalid QR code. Workstation not found.' };
    if (ws.status === 'outofsvc') return { error: 'Workstation is out of service.' };
    if (ws.status === 'checkedin') return { error: 'Workstation already checked in.' };

    const userId = state.currentUser.id;
    const existing = state.checkIns.find(c => c.userId === userId && !c.checkoutAt);
    if (existing) return { error: 'You already have an active check-in session.' };

    const id = 'CI' + Date.now();
    const ci = { id, userId, wsId: ws.id, reservationId: null, checkinAt: new Date().toISOString(), checkoutAt: null };
    state.checkIns.push(ci);
    updateWsStatus(ws.id, 'checkedin');
    addAuditLog(userId, 'CHECKIN', ws.id);
    return { success: true, session: ci, workstation: ws };
  }

  function checkOut(wsId) {
    const ci = state.checkIns.find(c => c.wsId === wsId && c.userId === state.currentUser.id && !c.checkoutAt);
    if (!ci) return { error: 'No active session for this workstation.' };
    ci.checkoutAt = new Date().toISOString();
    updateWsStatus(wsId, 'available');
    addAuditLog(state.currentUser.id, 'CHECKOUT', wsId);
    return { success: true, session: ci };
  }

  /* ---------- Fault reports ---------- */
  function createFaultReport(wsId, description, severity) {
    const id = 'FR' + Date.now();
    const fr = { id, wsId, userId: state.currentUser.id, description, severity: severity || 'medium', status:'open', createdAt: new Date().toISOString() };
    state.faultReports.push(fr);
    addAuditLog(state.currentUser.id, 'FAULT_REPORT', `${wsId}: ${description}`);
    return { success: true, report: fr };
  }

  function updateFaultStatus(frId, newStatus) {
    const fr = state.faultReports.find(f => f.id === frId);
    if (!fr) return { error: 'Report not found.' };
    fr.status = newStatus;
    if (newStatus === 'resolved') updateWsStatus(fr.wsId, 'available');
    if (newStatus === 'in_progress') updateWsStatus(fr.wsId, 'outofsvc');
    addAuditLog(state.currentUser.id, 'FAULT_UPDATE', `${frId} → ${newStatus}`);
    return { success: true };
  }

  /* ---------- Notifications & Audit ---------- */
  function addNotification(userId, message) {
    state.notifications.push({ id:'N'+Date.now(), userId, message, read:false, time: new Date().toISOString() });
  }
  function addAuditLog(userId, action, detail) {
    state.auditLog.push({ id:'AL'+Date.now(), userId, action, detail, time: new Date().toISOString() });
  }

  /* ---------- Analytics ---------- */
  function getAnalytics() {
    const ws = state.workstations;
    return {
      total:        ws.length,
      available:    ws.filter(w => w.status === 'available').length,
      reserved:     ws.filter(w => w.status === 'reserved').length,
      checkedIn:    ws.filter(w => w.status === 'checkedin').length,
      outOfService: ws.filter(w => w.status === 'outofsvc').length,
      openFaults:   state.faultReports.filter(f => f.status === 'open').length,
      totalReservations: state.reservations.filter(r => r.status !== 'cancelled').length,
      todayCheckIns: state.checkIns.filter(c => c.checkinAt?.startsWith(new Date().toISOString().slice(0,10))).length,
      utilizationRate: Math.round((ws.filter(w => ['reserved','checkedin'].includes(w.status)).length / ws.length) * 100)
    };
  }

  /* ---------- Announcements ---------- */
  function createAnnouncement(title, body) {
    const id = 'AN' + Date.now();
    state.announcements.unshift({ id, title, body, date: new Date().toISOString().slice(0,10), author: state.currentUser.name });
    return { success: true };
  }

  return {
    login, logout, restoreSession, requireAuth,
    get state() { return state; },
    getWorkstation, updateWsStatus,
    createReservation, cancelReservation,
    checkIn, checkOut,
    createFaultReport, updateFaultStatus,
    addNotification, addAuditLog,
    getAnalytics, createAnnouncement
  };
})();

/* ============================================================
   UI Helpers – Toast, Modal, Tabs
   ============================================================ */

function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✔', error: '✖', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}

function initTabs(containerSel) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  const buttons = container.querySelectorAll('.tab-btn');
  const panes   = document.querySelectorAll('.tab-pane');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.remove('hidden');
    });
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function statusBadge(status) {
  const map = {
    available:  ['badge-available', 'Available'],
    reserved:   ['badge-reserved',  'Reserved'],
    checkedin:  ['badge-checkedin', 'Checked In'],
    outofsvc:   ['badge-outofsvc',  'Out of Service'],
    open:       ['badge-outofsvc',  'Open'],
    in_progress:['badge-reserved',  'In Progress'],
    resolved:   ['badge-available', 'Resolved'],
    active:     ['badge-checkedin', 'Active'],
    cancelled:  ['badge-outofsvc',  'Cancelled'],
    completed:  ['badge-available', 'Completed'],
  };
  const [cls, label] = map[status] || ['badge-gold', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* Generate a simple SVG QR placeholder */
function generateQRSVG(text) {
  const size = 160;
  const cells = 12;
  const cell = Math.floor(size / cells);
  let rects = '';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const hash = (text.charCodeAt(r % text.length) ^ (c * 7 + r * 13)) % 3;
      if (hash === 0) {
        rects += `<rect x="${c*cell}" y="${r*cell}" width="${cell}" height="${cell}" fill="#0D1B2A"/>`;
      }
    }
  }
  // Corner finder patterns
  const fp = (x,y) => `<rect x="${x}" y="${y}" width="${cell*3}" height="${cell*3}" fill="#0D1B2A"/>
    <rect x="${x+cell}" y="${y+cell}" width="${cell}" height="${cell}" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    ${rects}
    ${fp(0,0)}${fp(size-cell*3,0)}${fp(0,size-cell*3)}
    <rect x="${size/2-cell}" y="${size/2-cell}" width="${cell*2}" height="${cell*2}" fill="#C9A84C"/>
  </svg>`;
}
