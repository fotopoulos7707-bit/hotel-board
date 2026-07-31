import { supabase } from "./supabase";
import Auth from "./Auth";
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, User, Phone, Mail, Users, Wrench, RefreshCw } from 'lucide-react';

function dbToStay(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    guestName: row.guest_name,
    phone: row.phone,
    email: row.email,
    pax: row.pax,
    checkIn: row.check_in,
    checkOut: row.check_out,
    notes: row.notes,
  };
}

function stayToDb(stay) {
  return {
    room_id: stay.roomId,
    type: stay.type,
    guest_name: stay.guestName,
    phone: stay.phone,
    email: stay.email,
    pax: stay.pax,
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    notes: stay.notes,
  };
}



const STAYS_KEY = 'hotel-stays-v1';
const ROOMS_KEY = 'hotel-rooms-v1';

const HEADER_HEIGHT = 52;

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseISO(s) { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function dayIndexBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
function fmtWeekday(d) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
function fmtMonth(d) { return d.toLocaleDateString(undefined, { month: 'short' }); }
function uid() { return Math.random().toString(36).slice(2, 10); }



// Custom rooms grouped by square meters: 40m^2, 60m^2, then 80m^2
const defaultRooms = [
  // 40m^2 Group
  { id: 12, name: '12', size: '40m²' },
  { id: 14, name: '14', size: '40m²' },
  { id: 22, name: '22', size: '40m²' },
  { id: 24, name: '24', size: '40m²' },
  { id: 32, name: '32', size: '40m²' },
  { id: 43, name: '43', size: '40m²' },
  // 60m^2 Group
  { id: 11, name: '11', size: '60m²' },
  { id: 13, name: '13', size: '60m²' },
  { id: 21, name: '21', size: '60m²' },
  { id: 23, name: '23', size: '60m²' },
  // 80m^2 Group
  { id: 41, name: '41', size: '80m²' },
  { id: 42, name: '42', size: '80m²' }
];

function buildDefaultStays() {
  const today = startOfDay(new Date());
  const iso = (n) => toISO(addDays(today, n));
  return [
    { id: uid(), roomId: 11, type: 'stay', guestName: 'Elena Marks', phone: '555-0142', email: 'elena.m@example.com', pax: 2, checkIn: iso(-2), checkOut: iso(2), notes: 'Late checkout requested' },
    { id: uid(), roomId: 12, type: 'stay', guestName: 'Tomas Rivera', phone: '555-0198', email: '', pax: 1, checkIn: iso(-3), checkOut: iso(0), notes: '' },
    { id: uid(), roomId: 12, type: 'stay', guestName: 'Priya Nandan', phone: '555-0166', email: 'priya.n@example.com', pax: 2, checkIn: iso(0), checkOut: iso(4), notes: 'Arriving after 6pm' },
    { id: uid(), roomId: 13, type: 'stay', guestName: 'Marco Bellini', phone: '555-0120', email: '', pax: 3, checkIn: iso(3), checkOut: iso(6), notes: '' },
    { id: uid(), roomId: 14, type: 'blocked', guestName: 'Plumbing repair', phone: '', email: '', pax: 1, checkIn: iso(-1), checkOut: iso(2), notes: 'Facilities ticket #221' },
    { id: uid(), roomId: 22, type: 'stay', guestName: 'Aiko Tanaka', phone: '555-0177', email: '', pax: 1, checkIn: iso(0), checkOut: iso(1), notes: '' },
  ];
}

async function safeGet(key, shared) {
  if (!window.storage) return null;
  try { const r = await window.storage.get(key, shared); return r ? r.value : null; }
  catch (e) { return null; }
}
async function safeSet(key, value, shared) {
  if (!window.storage) return false;
  try { await window.storage.set(key, value, shared); return true; }
  catch (e) { return false; }
}

function getStayLook(stay, todayISO) {
  if (stay.type === 'blocked') {
    return { bgClass: '', borderClass: 'border-rose-400', textClass: 'text-rose-900', hatch: true, bracketClass: 'border-rose-700' };
  }
  if (todayISO >= stay.checkIn && todayISO < stay.checkOut) {
    return { bgClass: 'bg-emerald-600', borderClass: 'border-emerald-700', textClass: 'text-white', hatch: false, bracketClass: 'border-white' };
  }
  if (todayISO < stay.checkIn) {
    return { bgClass: 'bg-amber-400', borderClass: 'border-amber-500', textClass: 'text-stone-900', hatch: false, bracketClass: 'border-stone-900' };
  }
  return { bgClass: 'bg-stone-200', borderClass: 'border-stone-300', textClass: 'text-stone-500', hatch: false, bracketClass: 'border-stone-500' };
}

function StayModal({ mode, draft, setDraft, rooms, role, error, onSave, onDelete, onClose }) {
  const canEditModal = role === 'admin';
  const isBlocked = draft.type === 'blocked';

  function field(key, value) { setDraft({ ...draft, [key]: value }); }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="font-serif text-lg font-semibold text-stone-900">
            {!canEditModal ? 'Stay details' : mode === 'add' ? 'New stay' : 'Edit stay'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        {!canEditModal ? (
          <div className="px-5 py-4 space-y-3 text-sm">
            <div><span className="text-stone-500">Room ID</span><div className="font-medium">{rooms.find(r => r.id === draft.roomId)?.name ?? draft.roomId}</div></div>
            <div><span className="text-stone-500">{isBlocked ? 'Reason' : 'Guest'}</span><div className="font-medium">{draft.guestName}</div></div>
            {!isBlocked && <div><span className="text-stone-500">Πελάτες</span><div className="font-medium">{draft.pax}</div></div>}
            <div><span className="text-stone-500">Check-in</span><div className="font-medium font-mono">{draft.checkIn}</div></div>
            <div><span className="text-stone-500">Check-out</span><div className="font-medium font-mono">{draft.checkOut}</div></div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => field('type', 'stay')} className={`flex-1 text-sm font-medium py-2 rounded-md ${!isBlocked ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}>Νέα Κράτηση</button>
              <button onClick={() => field('type', 'blocked')} className={`flex-1 text-sm font-medium py-2 rounded-md ${isBlocked ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}>Out of service</button>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Δωμάτιο</label>
              <select value={draft.roomId} onChange={(e) => field('roomId', Number(e.target.value))} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.size})</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Check-in</label>
                <input type="date" value={draft.checkIn} onChange={(e) => field('checkIn', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Check-out</label>
                <input type="date" value={draft.checkOut} onChange={(e) => field('checkOut', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">{isBlocked ? 'Reason' : 'Όνομα Πελάτη'}</label>
              <input type="text" value={draft.guestName} onChange={(e) => field('guestName', e.target.value)} placeholder={isBlocked ? 'Maintenance, deep clean...' : 'Full name'} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {!isBlocked && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Phone</label>
                  <input type="text" value={draft.phone} onChange={(e) => field('phone', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="w-20">
                  <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Πελάτες</label>
                  <input type="number" min="1" max="8" value={draft.pax} onChange={(e) => field('pax', Number(e.target.value))} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            )}

            {!isBlocked && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Email</label>
                <input type="text" value={draft.email} onChange={(e) => field('email', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Notes</label>
              <textarea rows={2} value={draft.notes} onChange={(e) => field('notes', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-200">
          {canEditModal && mode === 'edit' ? (
            <button onClick={onDelete} className="flex items-center gap-1 text-rose-600 text-sm font-medium hover:text-rose-700">
              <Trash2 size={15} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900">
              {canEditModal ? 'Cancel' : 'Close'}
            </button>
            {canEditModal && (
              <button onClick={onSave} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800">
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [rooms, setRooms] = useState(defaultRooms);
  const [stays, setStays] = useState([]);
  const role = profile?.role ?? "";

  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isHousekeeping = role === "housekeeping";

  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;
  

  const [viewStart, setViewStart] = useState(startOfDay(new Date()));
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 700 : false);
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [storageOK, setStorageOK] = useState(true);

  

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 700); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadData = useCallback(async () => {
  setSyncing(true);

  try {
    const roomsRaw = await safeGet(ROOMS_KEY, true);

    const { data, error } = await supabase
      .from("stays")
      .select("*");

    if (error) throw error;

    const staysRaw = data.map(dbToStay);

    let r = roomsRaw ? JSON.parse(roomsRaw) : null;
    let s = staysRaw;
    let ok = true;

    if (!r || !r[0]?.size) {
      r = defaultRooms;
      ok = await safeSet(ROOMS_KEY, JSON.stringify(r), true);
    }

    if (!s) s = [];

    setRooms(r);
    setStays(s);
    setStorageOK(ok !== false);
    setLastSynced(new Date());

  } catch (err) {
    console.error(err);
  } finally {
    setSyncing(false);
    setLoading(false);
  }

}, []);

  useEffect(() => {
  const channel = supabase
    .channel("stays")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stays",
      },
      () => {
        loadData();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [loadData]);

  useEffect(() => {
    loadData();
    
    // const iv = setInterval(loadData, 5000);
    function onVis() { if (document.visibilityState === 'visible') loadData(); }
    document.addEventListener('visibilitychange', onVis);
    return () => {  document.removeEventListener('visibilitychange', onVis); };
  }, [loadData]);

  // clearInterval(iv);
  useEffect(() => {
  async function loadSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      setUser(session.user);
    }
  }

  loadSession();
  }, []);

  useEffect(() => {
  if (!user) return;

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (error) {
      console.error(error);
      return;
    }

    setProfile(data);
  }

  loadProfile();
  }, [user]);


  async function persistStays(next) {
  setStays(next);

  try {
    const { error: deleteError } = await supabase
      .from("stays")
      .delete()
      .neq("id", 0);

    if (deleteError) throw deleteError;

    const rows = next.map(stayToDb);

    const { error: insertError } = await supabase
      .from("stays")
      .insert(rows);

    if (insertError) throw insertError;

  } catch (err) {
    console.error(err);
  }
}

  function openAddModal(roomId, dateISO) {
    if (!canCreate) return;
    setModal({
      mode: 'add',
      draft: { id: null, roomId, type: 'stay', guestName: '', phone: '', email: '', pax: 1, checkIn: dateISO, checkOut: toISO(addDays(parseISO(dateISO), 1)), notes: '' },
    });
    setModalError('');
  }

  function openEditModal(stay) {
    setModal({ mode: 'edit', draft: { ...stay } });
    setModalError('');
  }

  function closeModal() { setModal(null); setModalError(''); }

  function setDraft(draft) { setModal({ ...modal, draft }); }

  function handleSave() {
    const d = modal.draft;
    if (d.id ? !canEdit : !canCreate) {
      setModalError('You do not have permission to make this change.');
      return;
    }
    if (!d.guestName || !d.guestName.trim()) {
      setModalError(d.type === 'blocked' ? 'Reason is required.' : 'Το όνομα του πελάτη είναι υποχρεωτικό.');
      return;
    }
    if (!(d.checkOut > d.checkIn)) {
      setModalError('Check-out must be after check-in.');
      return;
    }
    const overlap = stays.some(s => s.roomId === d.roomId && s.id !== d.id && d.checkIn < s.checkOut && d.checkOut > s.checkIn);
    if (overlap) {
      setModalError('Ταυτίζεται με άλλη διανυκτέρευση στο ίδιο δωμάτιο.');
      return;
    }
    let next;
    if (d.id) next = stays.map(s => (s.id === d.id ? { ...d } : s));
    else next = [...stays, { ...d, id: uid() }];
    persistStays(next);
    closeModal();
  }

  function handleDelete() {
    if (!canDelete) return;
    if (!modal.draft.id) return;
    persistStays(stays.filter(s => s.id !== modal.draft.id));
    closeModal();
  }

  const numDays = isMobile ? 7 : 14;
  const colWidth = isMobile ? 66 : 104;
  const roomColWidth = isMobile ? 76 : 132;
  const rowHeight = isMobile ? 58 : 68;

  const today = startOfDay(new Date());
  const todayISO = toISO(today);
  const viewDays = Array.from({ length: numDays }, (_, i) => addDays(viewStart, i));
  const viewEnd = addDays(viewStart, numDays);

  const rangeLabel = `${fmtMonth(viewDays[0])} ${viewDays[0].getDate()} \u2013 ${fmtMonth(viewDays[numDays - 1])} ${viewDays[numDays - 1].getDate()}`;

  const occupiedCount = stays.filter(s => s.type === 'stay' && todayISO >= s.checkIn && todayISO < s.checkOut).length;
  const blockedCount = stays.filter(s => s.type === 'blocked' && todayISO >= s.checkIn && todayISO < s.checkOut).length;

  if (!user) {
  return <Auth onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
              Room board
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 font-mono mt-1">
              {occupiedCount}/{rooms.length} Πληρότητα Σήμερα &middot; {blockedCount} Εκτός Λειτουργίας &middot; {rangeLabel}
              {syncing && <RefreshCw size={11} className="inline ml-2 animate-spin align-[-1px]" />}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-stone-300 px-3 py-2 text-sm">
              {profile?.full_name}
              <div className="text-xs text-stone-500">
                {profile?.role}
              </div>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setProfile(null);
              }}
              className="px-3 py-2 rounded-md bg-stone-900 text-white"
            >
              Logout
            </button>
            <div className="flex items-center rounded-md border border-stone-300 overflow-hidden">
              <button onClick={() => setViewStart(addDays(viewStart, -numDays))} className="p-2 hover:bg-stone-100"><ChevronLeft size={16} /></button>
              <button onClick={() => setViewStart(startOfDay(new Date()))} className="px-3 py-2 text-xs font-semibold border-x border-stone-300 hover:bg-stone-100">Today</button>
              <button onClick={() => setViewStart(addDays(viewStart, numDays))} className="p-2 hover:bg-stone-100"><ChevronRight size={16} /></button>
            </div>
            {canCreate && (
                <button
                  onClick={() => openAddModal(rooms[0]?.id ?? 1, todayISO)}
                  className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-md text-xs font-semibold hover:bg-emerald-700"
                >
                  <Plus size={14} /> New stay
                </button>
              )}
          </div>
        </header>
            
        <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] sm:text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> Κατειλημμένο</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Κλεισμένο</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-rose-400 inline-block" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fecdd3, #fecdd3 3px, #fff1f2 3px, #fff1f2 6px)' }} /> Εκτός Λειτουργίας</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-3 inline-block rounded-sm bg-red-600" /> Αναχώρηση και Άφιξη</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-stone-300 inline-block" /> Ελεύθερο {role === 'admin' && '(πατήστε για προσθήκη)'}</span>
        </div>

        {!storageOK && (
          <div className="mb-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            Changes aren't syncing right now &mdash; storage is unavailable. Edits made here may not reach other devices.
          </div>
        )}

        <div className="overflow-auto rounded-lg border border-stone-200 bg-white shadow-sm" style={{ maxHeight: '75vh' }}>
          <div style={{ minWidth: roomColWidth + numDays * colWidth }}>

            <div className="flex sticky top-0 z-30 bg-stone-900 border-b border-stone-700">
              <div className="sticky left-0 z-40 flex items-center justify-center bg-stone-900 border-r border-stone-700" style={{ width: roomColWidth, flexShrink: 0, height: HEADER_HEIGHT }}>
                <span className="font-mono text-[9px] text-stone-400 uppercase tracking-widest">Δωμάτιο</span>
              </div>
              <div className="flex">
                {viewDays.map((d) => {
                  const iso = toISO(d);
                  const isToday = iso === todayISO;
                  return (
                    <div key={iso} className={`flex flex-col items-center justify-center border-l border-stone-800 ${isToday ? 'bg-amber-500 text-stone-900' : 'text-stone-300'}`} style={{ width: colWidth, flexShrink: 0, height: HEADER_HEIGHT }}>
                      <span className="font-mono text-[9px] uppercase tracking-wide opacity-80">{fmtWeekday(d)}</span>
                      <span className="font-serif text-sm sm:text-base font-semibold leading-none mt-0.5">{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {rooms.map((room, roomIdx) => {
              const nextRoom = rooms[roomIdx + 1];
              const isGroupBoundary = nextRoom && nextRoom.size !== room.size;
              const staysForRoom = stays.filter(s => s.roomId === room.id);
              const sorted = [...staysForRoom].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
              const turnovers = [];
              for (let i = 0; i < sorted.length - 1; i++) {
                const a = sorted[i], b = sorted[i + 1];
                if (a.type === 'stay' && b.type === 'stay' && a.checkOut === b.checkIn) {
                  const idx = dayIndexBetween(viewStart, parseISO(a.checkOut));
                  if (idx >= 0 && idx <= numDays) turnovers.push(idx);
                }
              }
              
              if (loading) {
                return (
                  <div className="flex h-screen items-center justify-center text-xl">
                    Loading...
                  </div>
                );
              }

              return (
                <div key={room.id} className="flex border-b border-stone-200" style={{ height: rowHeight }}>
                  <div className="sticky left-0 z-20 flex items-center justify-center bg-stone-900 border-r border-stone-700" style={{ width: roomColWidth, flexShrink: 0 }}>
                    <div className="text-center">
                      <div className="font-serif text-amber-300 text-base sm:text-lg font-bold leading-none">{room.name}</div>
                      <div className="font-mono text-[8px] sm:text-[9px] text-stone-400 uppercase tracking-widest mt-0.5">{room.size}</div>
                    </div>
                  </div>

                  <div className={`relative ${isGroupBoundary ? 'border-b-2 border-stone-900' : ''}`} style={{ width: numDays * colWidth, flexShrink: 0 }}>
                    <div className="absolute inset-0 flex">
                      {viewDays.map((d) => {
                        const iso = toISO(d);
                        const isToday = iso === todayISO;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={iso}
                            onClick={canCreate ? () => openAddModal(room.id, iso) : undefined}
                            className={`h-full border-l border-stone-200 ${isToday ? 'bg-amber-50' : isWeekend ? 'bg-stone-50' : 'bg-white'} ${role === 'admin' ? 'cursor-pointer hover:bg-stone-100' : ''}`}
                            style={{ width: colWidth, flexShrink: 0 }}
                          />
                        );
                      })}
                    </div>

                    {turnovers.map((idx) => (
                      <div
                        key={`turn-${idx}`}
                        title="Turnover \u2014 change linens before next check-in"
                        className="absolute z-[5] rounded-sm bg-red-600 border border-red-800"
                        style={{
                          left: idx * colWidth - 2,
                          top: 2,
                          width: 5,
                          height: rowHeight - 4,
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
                        }}
                      />
                    ))}

                    {staysForRoom.map((stay) => {
                      const ci = parseISO(stay.checkIn), co = parseISO(stay.checkOut);
                      if (co <= viewStart || ci >= viewEnd) return null;
                      const startIdx = dayIndexBetween(viewStart, ci);
                      const endIdx = dayIndexBetween(viewStart, co);
                      const clampedStart = Math.max(startIdx, 0);
                      const clampedEnd = Math.min(endIdx, numDays);
                      const left = clampedStart * colWidth;
                      const width = Math.max((clampedEnd - clampedStart) * colWidth - 4, colWidth - 4);
                      const look = getStayLook(stay, todayISO);

                      return (
                        <div
                          key={stay.id}
                          onClick={() => openEditModal(stay)}
                          className={`absolute rounded-md border cursor-pointer shadow-sm flex flex-col justify-center px-2 ${look.bgClass} ${look.borderClass} ${look.textClass}`}
                          style={{
                            left: left + 2,
                            width,
                            top: 6,
                            height: rowHeight - 12,
                            backgroundImage: look.hatch ? 'repeating-linear-gradient(45deg, #fecdd3, #fecdd3 4px, #fff1f2 4px, #fff1f2 8px)' : undefined,
                          }}
                        >
                          {/* Check-in bracket (start) */}
                          <div className={`absolute -left-[1px] -top-[1px] w-2 h-2 border-t-2 border-l-2 rounded-tl-sm ${look.bracketClass}`} />
                          <div className={`absolute -left-[1px] -bottom-[1px] w-2 h-2 border-b-2 border-l-2 rounded-bl-sm ${look.bracketClass}`} />
                          {/* Check-out bracket (end) */}
                          <div className={`absolute -right-[1px] -top-[1px] w-2 h-2 border-t-2 border-r-2 rounded-tr-sm ${look.bracketClass}`} />
                          <div className={`absolute -right-[1px] -bottom-[1px] w-2 h-2 border-b-2 border-r-2 rounded-br-sm ${look.bracketClass}`} />

                          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold truncate">
                            {stay.type === 'blocked' ? <Wrench size={11} /> : <User size={11} />}
                            <span className="truncate">{stay.guestName}</span>
                          </div>
                          <div className="text-[10px] sm:text-[11px] opacity-80 truncate font-mono">
                            {stay.type === 'blocked' ? 'Out of service' : `${stay.pax} ${stay.pax > 1 ? 'Πελάτες' : 'Πελάτης'}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-stone-400 mt-3">
          Admin and staff views share the same board and stay data &mdash; changes made as Admin appear on Staff devices within a few seconds. The Admin/Staff toggle itself is remembered per device only.
        </p>
      </div>

      {modal && (
        <StayModal
          mode={modal.mode}
          draft={modal.draft}
          setDraft={setDraft}
          rooms={rooms}
          role={role}
          error={modalError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeModal}
        />
      )}
    </div>
  );
}