import { supabase } from "./supabase";
import Auth from "./Auth";
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, User, Users, Wrench, RefreshCw, StickyNote } from 'lucide-react';

function dbToStay(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    guestName: row.guest_name,
    extraSpaces: row.extra_spaces,
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
    extra_spaces: stay.extraSpaces,
    pax: stay.pax,
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    notes: stay.notes,
  };
}

async function saveStay(stay) {
  const row = stayToDb(stay);
  if (stay.id) {
    const { error } = await supabase.from('stays').update(row).eq('id', stay.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('stays').insert(row);
    if (error) throw error;
  }
}

async function deleteStay(id) {
  const { error } = await supabase.from('stays').delete().eq('id', id);
  if (error) throw error;
}

const STAYS_KEY = 'hotel-stays-v1';
const ROOMS_KEY = 'hotel-rooms-v1';

const HEADER_HEIGHT = 52;
const SECTION_LABEL_HEIGHT = 32;

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
  { id: 42, name: '42', size: '80m²' },
  // Villa Christina
  { id: 2, name: '2', size: '-' },
  { id: 3, name: '3', size: '-' },
  { id: 4, name: '4', size: '-' },
  { id: 5, name: '5', size: '-' },
  { id: 6, name: '6', size: '-' }
];

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

async function addTask(roomId, date, taskType) {
  if (!date || !roomId || !taskType || !taskType.trim()) return;

  const { error } = await supabase
    .from("housekeeping_tasks")
    .insert({
      room_id: roomId,
      task_type: taskType.trim().toLowerCase(),
      task_date: date,
    });

  if (error) throw error;
}

async function deleteTask(taskId) {
  const { error } = await supabase
    .from("housekeeping_tasks")
    .delete()
    .eq("id", taskId);

  if (error) throw error;
}

const VILLAS = { karayiannis: 'Karayiannis Villas', christina: 'Villa Christina' };

async function saveDayNote(dateISO, villa, text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    const { error } = await supabase.from("day_notes").delete().eq("note_date", dateISO).eq("villa", villa);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("day_notes")
    .upsert({ note_date: dateISO, villa, note: trimmed }, { onConflict: 'note_date,villa' });
  if (error) throw error;
}

function paxLabel(pax) {
  const trimmed = (pax ?? '').toString().trim();
  if (!trimmed) return '';
  const n = Number(trimmed);
  if (Number.isFinite(n) && String(n) === trimmed) {
    return `${trimmed} ${n > 1 ? 'Πελάτες' : 'Πελάτης'}`;
  }
  return trimmed;
}

function initialsFor(profile) {
  const name = (profile?.full_name || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function addChecklistItem(dateISO, villa, content) {
  const trimmed = (content || '').trim();
  if (!trimmed) return;

  const { data, error } = await supabase
    .from('day_checklist_items')
    .insert({
      note_date: dateISO,
      villa,
      content: trimmed
    })
    .select()
    .single();

  if (error) throw error;


}

async function deleteChecklistItem(id) {
  const { error } = await supabase.from('day_checklist_items').delete().eq('id', id);
  if (error) throw error;
}

async function toggleChecklistItem(item, initials) {
  if (item.checked) {
    const { error } = await supabase
      .from('day_checklist_items')
      .update({ checked: false, checked_by: null, checked_at: null })
      .eq('id', item.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('day_checklist_items')
      .update({ checked: true, checked_by: initials, checked_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) throw error;
  }
}

async function saveChecklistBatch(newItems, modifiedItems, deletedIds) {
  if (deletedIds.length > 0) {
    const { error } = await supabase.from('day_checklist_items').delete().in('id', deletedIds);
    if (error) throw error;
  }
  
  if (newItems.length > 0) {
    const itemsToInsert = newItems.map(i => ({
      note_date: i.note_date,
      villa: i.villa,
      content: i.content,
      checks: i.checks || []
    }));
    const { error } = await supabase.from('day_checklist_items').insert(itemsToInsert);
    if (error) throw error;
  }
  
  for (const item of modifiedItems) {
    const { error } = await supabase.from('day_checklist_items').update({
      checks: item.checks || []
    }).eq('id', item.id);
    if (error) throw error;
  }
}

function taskBadges(tasksForCell) {
  const hasSheet = tasksForCell.some((t) => t.task_type === 'sheet');
  const hasTowel = tasksForCell.some((t) => t.task_type === 'towel');
  return `${hasSheet ? '\u{1F7E5}' : ''}${hasTowel ? '\u{1F7E6}' : ''}`;
}

const TASK_LABELS = { sheet: 'Σεντόνια', towel: 'Πετσέτες' };

const TEXT_OUTLINE_STYLE = {
  textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px rgba(255,255,255,0.9)',
};

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

function MobileDayList({ rooms, stays, tasks, date, todayISO, canCreate, canManageTasks, isAdmin, hasNote, onOpenRoom, onOpenTask, onOpenNote, onPrevDay, onNextDay, onToday }) {
  const dateObj = parseISO(date);
  const label = dateObj.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' });
  const isToday = date === todayISO;

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2 bg-stone-900">
        <button onClick={onPrevDay} className="text-stone-300 hover:text-white p-2 active:bg-stone-800 rounded-md">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center flex items-center gap-1.5">
          <div>
            <div className="font-serif text-white text-sm sm:text-base font-semibold capitalize">{label}</div>
            {!isToday && (
              <button onClick={onToday} className="text-[10px] text-amber-300 uppercase tracking-wide font-mono">
                Πήγαινε στο Σήμερα
              </button>
            )}
          </div>
          {isAdmin && (
            <button onClick={onOpenNote} title="Σημειώσεις της ημέρας" className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
              <Plus size={13} />
            </button>
          )}
          {!isAdmin && hasNote && (
            <button onClick={onOpenNote} title="Σημειώσεις της ημέρας" className="w-6 h-6 flex items-center justify-center rounded-full text-amber-300">
              <StickyNote size={14} />
            </button>
          )}
        </div>
        <button onClick={onNextDay} className="text-stone-300 hover:text-white p-2 active:bg-stone-800 rounded-md">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="divide-y divide-stone-200">
        {rooms.map((room, roomIdx) => {
          const nextRoom = rooms[roomIdx + 1];
          const isGroupBoundary = nextRoom && nextRoom.size !== room.size;
          const stay = stays.find((s) => s.roomId === room.id && date >= s.checkIn && date < s.checkOut);
          const departingStay = stays.find((s) => s.roomId === room.id && s.type === 'stay' && s.checkOut === date);
          const arrivingStay = stays.find((s) => s.roomId === room.id && s.type === 'stay' && s.checkIn === date);
          
          // Check if today is the last night (i.e. checkOut is tomorrow)
          const tomorrowISO = toISO(addDays(parseISO(date), 1));
          const isLastNight = stay && stay.type === 'stay' && stay.checkOut === tomorrowISO;

          const isTurnover = !!(departingStay && arrivingStay && departingStay.id !== arrivingStay.id);
          const isArrival = !!arrivingStay && !isTurnover;
          const cellTasks = tasks.filter((t) => t.room_id === room.id && t.task_date === date);
          const badges = taskBadges(cellTasks);
          const look = stay ? getStayLook(stay, todayISO) : null;
          const isKarayiannisStart = room.id === 12;
          const isVillaChristinaStart = room.id === 2;

          return (
            <React.Fragment key={room.id}>
              {isKarayiannisStart && (
                <div className="bg-stone-800 px-3 py-1.5">
                  <span className="font-serif text-amber-300 text-xs font-semibold tracking-wide uppercase">Karayiannis Villas</span>
                </div>
              )}
              {isVillaChristinaStart && (
                <div className="bg-stone-800 px-3 py-1.5">
                  <span className="font-serif text-amber-300 text-xs font-semibold tracking-wide uppercase">Villa Christina</span>
                </div>
              )}
              <div
                onClick={() => onOpenRoom(room, stay)}
                title={isTurnover ? 'Αναχώρηση και Άφιξη — αλλαγή σεντονιών' : isArrival ? 'Άφιξη' : isLastNight ? 'Αναχώρηση αύριο' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 active:bg-stone-50 ${isGroupBoundary ? 'border-b-2 border-stone-900' : ''} ${isTurnover ? 'border-l-4 border-red-600' : isArrival ? 'border-l-4 border-amber-500' : isLastNight ? 'border-l-4 border-blue-500' : ''}`}
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-stone-900 flex flex-col items-center justify-center">
                  <span className="font-serif text-amber-300 text-base font-bold leading-none">{room.name}</span>
                  <span className="font-mono text-[7px] text-stone-400 uppercase tracking-widest mt-0.5 truncate max-w-[52px]">{room.size}</span>
                </div>

                <div
                  className={`flex-1 min-w-0 rounded-lg border px-3 py-2 ${stay ? `${look.bgClass} ${look.borderClass} ${look.textClass}` : 'bg-white border-stone-200 text-stone-400'} ${!stay && canCreate ? 'cursor-pointer' : ''}`}
                  style={stay && stay.type === 'blocked' ? { backgroundImage: 'repeating-linear-gradient(45deg, #fecdd3, #fecdd3 4px, #fff1f2 4px, #fff1f2 8px)' } : undefined}
                >
                  {isTurnover && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-0.5">
                      <span className="w-1.5 h-3 inline-block rounded-sm bg-red-600" /> <span style={TEXT_OUTLINE_STYLE}>Αναχώρηση &amp; Άφιξη</span>
                    </div>
                  )}
                  {isArrival && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-0.5">
                      <span className="w-1.5 h-3 inline-block rounded-sm bg-amber-500" /> <span style={TEXT_OUTLINE_STYLE}>Άφιξη</span>
                    </div>
                  )}
                  {isLastNight && !isTurnover && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-0.5">
                      <span className="w-1.5 h-3 inline-block rounded-sm bg-blue-500" /> <span style={TEXT_OUTLINE_STYLE}>Αναχώρηση αύριο</span>
                    </div>
                  )}
                  {stay ? (
                    <>
                      <div className="flex items-center gap-1 font-semibold text-sm truncate">
                        {stay.type === 'blocked' ? <Wrench size={13} /> : <User size={13} />}
                        <span className="truncate">{stay.type === 'blocked' ? stay.guestName : (stay.extraSpaces && stay.extraSpaces.trim() ? stay.extraSpaces : '—')}</span>
                        {stay.notes && stay.notes.trim() && <StickyNote size={12} className="flex-shrink-0 opacity-80" title={stay.notes} />}
                      </div>
                      <div className="text-xs opacity-80 font-mono">
                        {stay.type === 'blocked' ? 'Εκτός λειτουργίας' : paxLabel(stay.pax)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm">{canCreate ? 'Ελεύθερο — πατήστε για προσθήκη' : 'Ελεύθερο'}</div>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  {badges && <span className="text-lg leading-none">{badges}</span>}
                  {canManageTasks && stay && stay.type === 'stay' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenTask(room, date); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-900/80 text-white text-sm active:bg-stone-900"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
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
            {isBlocked && <div><span className="text-stone-500">Reason</span><div className="font-medium">{draft.guestName}</div></div>}
            {!isBlocked && (
              <div><span className="text-stone-500">Εξτρα Χώροι</span><div className="font-medium">{draft.extraSpaces && draft.extraSpaces.trim() ? draft.extraSpaces : ' '}</div></div>
            )}
            {!isBlocked && <div><span className="text-stone-500">Πελάτες</span><div className="font-medium">{draft.pax}</div></div>}
            <div><span className="text-stone-500">Check-in</span><div className="font-medium font-mono">{draft.checkIn}</div></div>
            <div><span className="text-stone-500">Check-out</span><div className="font-medium font-mono">{draft.checkOut}</div></div>
            {draft.notes && draft.notes.trim() && (
              <div><span className="text-stone-500">Σημειώσεις</span><div className="font-medium whitespace-pre-wrap">{draft.notes}</div></div>
            )}
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Εξτρα Χώροι</label>
                <input type="text" value={draft.extraSpaces || '  '} onChange={(e) => field('extraSpaces', e.target.value)} className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            )}

            {!isBlocked && (
              <div className="w-32">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Πελάτες</label>
                <input type="text" value={draft.pax ?? ''} onChange={(e) => field('pax', e.target.value)} placeholder="π.χ. 2 ή 2+1 παιδί" className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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

function TaskModal({ room, date, tasks, canEdit, onClose }) {
  const [sheetChecked, setSheetChecked] = useState(false);
  const [towelChecked, setTowelChecked] = useState(false);
  const [error, setError] = useState('');
  const tasksForCell = tasks.filter((t) => t.room_id === room.id && t.task_date === date);
  const hasSheet = tasksForCell.some((t) => t.task_type === 'sheet');
  const hasTowel = tasksForCell.some((t) => t.task_type === 'towel');

  async function handleAdd() {
    const types = [];
    if (sheetChecked && !hasSheet) types.push('sheet');
    if (towelChecked && !hasTowel) types.push('towel');
    if (types.length === 0) {
      setError('Επιλέξτε τουλάχιστον μία εργασία.');
      return;
    }
    setError('');
    try {
      for (const t of types) {
        await addTask(room.id, date, t);
      }
      setSheetChecked(false);
      setTowelChecked(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add task.');
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteTask(id);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete task.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div>
            <h2 className="font-serif text-lg font-semibold text-stone-900">Housekeeping</h2>
            <p className="text-xs text-stone-500 font-mono mt-0.5">{room.name} &middot; {date}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {tasksForCell.length === 0 ? (
            <p className="text-stone-400 text-xs">Δεν έχουν καταχωρηθεί εργασίες για αυτή τη μέρα.</p>
          ) : (
            <ul className="space-y-1.5">
              {tasksForCell.map((t) => (
                <li key={t.id} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5">
                  <span className="text-sm">
                    <span className="mr-1.5">{taskBadges([t])}</span>
                    <span className="text-stone-700">{TASK_LABELS[t.task_type] ?? t.task_type}</span>
                  </span>
                  {canEdit && (
                    <button onClick={() => handleDelete(t.id)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="pt-2 border-t border-stone-200">
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Προσθήκη εργασίας</label>
              <div className="flex flex-col gap-2 mt-2">
                <label className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 ${hasSheet ? 'border-stone-200 bg-stone-50 text-stone-400' : 'border-stone-300 text-stone-700 cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={sheetChecked}
                    disabled={hasSheet}
                    onChange={(e) => setSheetChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300"
                  />
                  <span>{'\u{1F7E5}'} Σεντόνια {hasSheet && '(ήδη προστέθηκε)'}</span>
                </label>
                <label className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 ${hasTowel ? 'border-stone-200 bg-stone-50 text-stone-400' : 'border-stone-300 text-stone-700 cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={towelChecked}
                    disabled={hasTowel}
                    onChange={(e) => setTowelChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300"
                  />
                  <span>{'\u{1F7E6}'} Πετσέτες {hasTowel && '(ήδη προστέθηκε)'}</span>
                </label>
              </div>
              <button onClick={handleAdd} className="w-full mt-2 px-3 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800">
                Προσθήκη
              </button>
              {error && <p className="text-rose-600 text-xs font-medium mt-1">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({ items, isAdmin, currentUserId, onAdd, onDelete, onToggle }) {
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setError('');
    try {
      onAdd(trimmed);
      setNewItem('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add item.');
    }
  }

  return (
    <div className="mt-2">
      {items.length === 0 ? (
        <p className="text-stone-400 text-xs">Δεν υπάρχουν εργασίες λίστας.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const checks = Array.isArray(item.checks) ? item.checks : [];
            // Is this box checked by the currently logged-in user?
            const isCheckedByMe = checks.some(c => c.user_id === currentUserId);

            return (
              <li key={item.id} className="flex items-start justify-between gap-2 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5">
                <label className="flex items-start gap-2 text-sm flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCheckedByMe}
                    onChange={() => onToggle(item)}
                    className="w-4 h-4 mt-0.5 rounded border-stone-300 flex-shrink-0 cursor-pointer"
                  />
                  <span className={isCheckedByMe ? 'text-stone-400 line-through' : 'text-stone-700'}>
                    {item.content}
                  </span>
                </label>

                {/* Show badges for ALL staff members who checked this box */}
                <div className="flex items-center gap-1 flex-wrap flex-shrink-0 justify-end">
                  {checks.map((chk, idx) => (
                    <span
                      key={chk.user_id || idx}
                      title={chk.checked_at ? new Date(chk.checked_at).toLocaleString('el-GR') : ''}
                      className={`text-[10px] font-mono font-semibold rounded px-1 ${
                        chk.user_id === currentUserId 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {chk.initials}
                    </span>
                  ))}

                  {isAdmin && (
                    <button onClick={() => onDelete(item.id)} className="text-rose-500 hover:text-rose-700 ml-1">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="Νέα εργασία λίστας..."
            className="flex-1 border border-stone-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800">
            Προσθήκη
          </button>
        </div>
      )}
      {error && <p className="text-rose-600 text-xs font-medium mt-1">{error}</p>}
    </div>
  );
}

function DayNoteModal({ date, karayiannisNote, christinaNote, karayiannisChecklist, christinaChecklist, isAdmin, canEdit, initials, userId, onSaveNote, onSaveChecklists, onClose }) {
  const [karayiannisText, setKarayiannisText] = useState(karayiannisNote || '');
  const [christinaText, setChristinaText] = useState(christinaNote || '');

  // Helper to standardise old DB format (single check) into array format
  const normalizeList = (list) => list.map(item => {
    if (Array.isArray(item.checks)) return item;
    const legacy = [];
    if (item.checked && item.checked_by) {
      legacy.push({ user_id: item.checked_by_id || 'legacy', initials: item.checked_by, checked_at: item.checked_at });
    }
    return { ...item, checks: legacy };
  });

  const [kChecklist, setKChecklist] = useState(() => normalizeList(karayiannisChecklist));
  const [cChecklist, setCChecklist] = useState(() => normalizeList(christinaChecklist));
  const [deletedIds, setDeletedIds] = useState([]);
  
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const dateObj = parseISO(date);
  const label = dateObj.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleAddLocal = (villa, content) => {
    const newItem = { id: `temp-${uid()}`, content, checks: [], isNew: true, villa, note_date: date };
    if (villa === 'karayiannis') setKChecklist([...kChecklist, newItem]);
    else setCChecklist([...cChecklist, newItem]);
  };

  const handleToggleLocal = (villa, item) => {
    const updater = (list) => list.map(i => {
      if (i.id === item.id) {
        const currentChecks = Array.isArray(i.checks) ? i.checks : [];
        const existingIdx = currentChecks.findIndex(c => c.user_id === userId);

        let updatedChecks;
        if (existingIdx >= 0) {
          // Toggle off: remove user's entry
          updatedChecks = currentChecks.filter(c => c.user_id !== userId);
        } else {
          // Toggle on: add user's entry
          updatedChecks = [
            ...currentChecks,
            { user_id: userId, initials: initials, checked_at: new Date().toISOString() }
          ];
        }

        return {
          ...i,
          checks: updatedChecks,
          isModified: !i.isNew
        };
      }
      return i;
    });
    
    if (villa === 'karayiannis') setKChecklist(updater(kChecklist));
    else setCChecklist(updater(cChecklist));
  };

  const handleDeleteLocal = (villa, id) => {
    if (!String(id).startsWith('temp-')) {
      setDeletedIds([...deletedIds, id]);
    }
    if (villa === 'karayiannis') setKChecklist(kChecklist.filter(i => i.id !== id));
    else setCChecklist(cChecklist.filter(i => i.id !== id));
  };

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (canEdit) {
        await onSaveNote('karayiannis', karayiannisText);
        await onSaveNote('christina', christinaText);
      }
      
      const allItems = [...kChecklist, ...cChecklist];
      const newItems = allItems.filter(i => i.isNew);
      const modifiedItems = allItems.filter(i => i.isModified);
      
      await onSaveChecklists(newItems, modifiedItems, deletedIds);
      
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div>
            <h2 className="font-serif text-lg font-semibold text-stone-900">Σημειώσεις της ημέρας</h2>
            <p className="text-xs text-stone-500 font-mono mt-0.5 capitalize">{label}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {canEdit ? (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Karayiannis Villas</label>
                <textarea
                  rows={4}
                  value={karayiannisText}
                  onChange={(e) => setKarayiannisText(e.target.value)}
                  placeholder="Σημειώσεις για τα Karayiannis Villas..."
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">Villa Christina</label>
                <textarea
                  rows={4}
                  value={christinaText}
                  onChange={(e) => setChristinaText(e.target.value)}
                  placeholder="Σημειώσεις για τη Villa Christina..."
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Karayiannis Villas</span>
                <p className="text-sm text-stone-700 whitespace-pre-wrap mt-1">
                  {karayiannisNote && karayiannisNote.trim() ? karayiannisNote : 'Δεν υπάρχουν σημειώσεις.'}
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Villa Christina</span>
                <p className="text-sm text-stone-700 whitespace-pre-wrap mt-1">
                  {christinaNote && christinaNote.trim() ? christinaNote : 'Δεν υπάρχουν σημειώσεις.'}
                </p>
              </div>
            </>
          )}

          {/* CHECKLISTS */}
          <div className="mt-2 pt-2 border-t border-stone-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Λίστα εργασιών (Karayiannis)</span>
            <ChecklistSection
              items={kChecklist}
              isAdmin={isAdmin}
              currentUserId={userId}
              onAdd={(content) => handleAddLocal('karayiannis', content)}
              onDelete={(id) => handleDeleteLocal('karayiannis', id)}
              onToggle={(item) => handleToggleLocal('karayiannis', item)}
            />
          </div>
          <div className="mt-2 pt-2 border-t border-stone-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Λίστα εργασιών (Christina)</span>
            <ChecklistSection
              items={cChecklist}
              isAdmin={isAdmin}
              currentUserId={userId}
              onAdd={(content) => handleAddLocal('christina', content)}
              onDelete={(id) => handleDeleteLocal('christina', id)}
              onToggle={(item) => handleToggleLocal('christina', item)}
            />
          </div>

          {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
          
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900">
              Ακύρωση
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50">
              Αποθήκευση
            </button>
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

  const [tasks, setTasks] = useState([]);
  const [dayNotes, setDayNotes] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);

  // HERE ARE THE MISSING FUNCTIONS
  const hasAnyNote = (dateISO) => {
    const hasTextNote = dayNotes.some(n => n.note_date === dateISO && n.note && n.note.trim() !== '');
    const hasChecklist = checklistItems.some(c => c.note_date === dateISO);
    return hasTextNote || hasChecklist;
  };

  const noteFor = (dateISO, villa) => {
    const n = dayNotes.find(n => n.note_date === dateISO && n.villa === villa);
    return n ? n.note : '';
  };

  const checklistFor = (dateISO, villa) => {
    return checklistItems
      .filter(c => c.note_date === dateISO && c.villa === villa)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  };

  const role = profile?.role ?? "";

  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isHousekeeping = role === "housekeeping";

  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;
  const canManageTasks = isAdmin;
  
  const [viewStart, setViewStart] = useState(() => addDays(startOfDay(new Date()), -7));
  const [mobileDate, setMobileDate] = useState(() => toISO(new Date()));
  const [mobileViewMode, setMobileViewMode] = useState('list');
  const [dayNoteModalDate, setDayNoteModalDate] = useState(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState('');
  const [taskModal, setTaskModal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [storageOK, setStorageOK] = useState(true);

  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth); }
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
      let ok = true;

      if (!r || !r[0]?.size) {
        r = defaultRooms;
        ok = await safeSet(ROOMS_KEY, JSON.stringify(r), true);
      }

      setRooms(r);
      setStays(staysRaw);
      setStorageOK(ok !== false);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Failed to load stays:', err);
      setStorageOK(false);
    }

    try {
      const { data: taskData, error: taskError } = await supabase
        .from("housekeeping_tasks")
        .select("*");

      if (taskError) throw taskError;
      setTasks(taskData ?? []);
    } catch (err) {
      console.error('Failed to load housekeeping tasks:', err);
    }

    try {
      const { data: noteData, error: noteError } = await supabase
        .from("day_notes")
        .select("*");

      if (noteError) throw noteError;
      setDayNotes(noteData ?? []);
    } catch (err) {
      console.error('Failed to load day notes:', err);
    }

    try {
      const { data: checklistData, error: checklistError } = await supabase
        .from("day_checklist_items")
        .select("*");

      if (checklistError) throw checklistError;
      setChecklistItems(checklistData ?? []);
    } catch (err) {
      console.error('Failed to load checklist items:', err);
    } finally {
      setSyncing(false);
      setLoading(false);
    }

  }, []);

  useEffect(() => {
    const channel = supabase
        .channel("housekeeping")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "housekeeping_tasks",
            },
            loadData
        )
        .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
        .channel("day-notes")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "day_notes",
            },
            loadData
        )
        .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
        .channel("day-checklist-items")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "day_checklist_items",
            },
            loadData
        )
        .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadData]);

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
    return () => supabase.removeChannel(channel);
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    loadData();
    function onVis() {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, loadData]);

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
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

  function openAddModal(roomId, dateISO) {
    if (!canCreate) return;
    setModal({
      mode: 'add',
      draft: { id: null, roomId, type: 'stay', guestName: '', extraSpaces: '', pax: '', checkIn: dateISO, checkOut: toISO(addDays(parseISO(dateISO), 1)), notes: '' },
    });
    setModalError('');
  }

  function openEditModal(stay) {
    setModal({ mode: 'edit', draft: { ...stay } });
    setModalError('');
  }

  function closeModal() { setModal(null); setModalError(''); }

  function setDraft(draft) { setModal({ ...modal, draft }); }

  function openTaskModal(room, dateISO) { setTaskModal({ room, date: dateISO }); }

  function closeTaskModal() { setTaskModal(null); }

  function handleMobileRoomOpen(room, stay) {
    if (stay) openEditModal(stay);
    else openAddModal(room.id, mobileDate);
  }

  async function handleSave() {
    const d = modal.draft;
    if (d.id ? !canEdit : !canCreate) {
      setModalError('You do not have permission to make this change.');
      return;
    }
    if (d.type === 'blocked' && (!d.guestName || !d.guestName.trim())) {
      setModalError('Reason is required.');
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
    try {
      await saveStay(d);
      closeModal();
    } catch (err) {
      console.error(err);
      setModalError(err.message || 'Failed to save.');
    }
  }

  async function handleDelete() {
    if (!canDelete) return;
    if (!modal.draft.id) return;
    try {
      await deleteStay(modal.draft.id);
      closeModal();
    } catch (err) {
      console.error(err);
      setModalError(err.message || 'Failed to delete.');
    }
  }

  const isMobile = windowWidth < 700;
  
  const todayForGrid = startOfDay(new Date());
  const todayISO = toISO(todayForGrid);

  const endOfNextMonth = new Date(todayForGrid.getFullYear(), todayForGrid.getMonth() + 2, 0);
  const daysToNextMonth = dayIndexBetween(viewStart, endOfNextMonth) + 1;
  const numDays = Math.max(daysToNextMonth, 21);

  const containerPadding = (isMobile ? 12 : 24) * 2 + 2;
  const availableWidth = Math.max(280, windowWidth - containerPadding);
  const MIN_COL_WIDTH = isMobile ? 34 : 60;
  const roomColWidth = Math.max(56, Math.round(availableWidth * (isMobile ? 0.16 : 0.12)));
  const colWidth = Math.max(MIN_COL_WIDTH, Math.floor((availableWidth - roomColWidth) / numDays));
  const rowHeight = isMobile ? 58 : 68;

  const viewDays = Array.from({ length: numDays }, (_, i) => addDays(viewStart, i));
  const viewEnd = addDays(viewStart, numDays);

  const rangeLabel = `${fmtMonth(viewDays[0])} ${viewDays[0].getDate()} \u2013 ${fmtMonth(viewDays[numDays - 1])} ${viewDays[numDays - 1].getDate()}`;

  const occupiedCount = stays.filter(s => s.type === 'stay' && todayISO >= s.checkIn && todayISO < s.checkOut).length;
  const blockedCount = stays.filter(s => s.type === 'blocked' && todayISO >= s.checkIn && todayISO < s.checkOut).length;

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl text-stone-500 font-serif">
        Loading board...
      </div>
    );
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
            {!isMobile && (
              <div className="flex items-center rounded-md border border-stone-300 overflow-hidden">
                <button onClick={() => setViewStart(addDays(viewStart, -30))} className="p-2 hover:bg-stone-100"><ChevronLeft size={16} /></button>
                <button onClick={() => setViewStart(addDays(startOfDay(new Date()), -7))} className="px-3 py-2 text-xs font-semibold border-x border-stone-300 hover:bg-stone-100">Today</button>
                <button onClick={() => setViewStart(addDays(viewStart, 30))} className="p-2 hover:bg-stone-100"><ChevronRight size={16} /></button>
              </div>
            )}
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
          <span className="flex items-center gap-1.5">{'\u{1F7E6}'} Πετσέτες</span>
          <span className="flex items-center gap-1.5">{'\u{1F7E5}'} Σεντόνια</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-stone-300 inline-block" /> Ελεύθερο {role === 'admin' && '(πατήστε για προσθήκη)'}</span>
        </div>

        {isMobile && (
          <div className="flex rounded-md overflow-hidden border border-stone-300 mb-3 w-fit">
            <button onClick={() => setMobileViewMode('list')} className={`px-3 py-1.5 text-xs font-semibold ${mobileViewMode === 'list' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}>Ημέρα</button>
            <button onClick={() => setMobileViewMode('grid')} className={`px-3 py-1.5 text-xs font-semibold ${mobileViewMode === 'grid' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}>Πλέγμα</button>
          </div>
        )}

        

        {isMobile && mobileViewMode === 'list' ? (
          <MobileDayList
            rooms={rooms}
            stays={stays}
            tasks={tasks}
            date={mobileDate}
            todayISO={todayISO}
            canCreate={canCreate}
            canManageTasks={canManageTasks}
            isAdmin={isAdmin}
            hasNote={hasAnyNote(mobileDate)}
            onOpenRoom={handleMobileRoomOpen}
            onOpenTask={openTaskModal}
            onOpenNote={() => setDayNoteModalDate(mobileDate)}
            onPrevDay={() => setMobileDate(toISO(addDays(parseISO(mobileDate), -1)))}
            onNextDay={() => setMobileDate(toISO(addDays(parseISO(mobileDate), 1)))}
            onToday={() => setMobileDate(toISO(new Date()))}
          />
        ) : (
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
                    <div key={iso} className={`relative flex flex-col items-center justify-center border-l border-stone-800 ${isToday ? 'bg-amber-500 text-stone-900' : 'text-stone-300'}`} style={{ width: colWidth, flexShrink: 0, height: HEADER_HEIGHT }}>
                      <span className="font-mono text-[9px] uppercase tracking-wide opacity-80">{fmtWeekday(d)}</span>
                      <span className="font-serif text-sm sm:text-base font-semibold leading-none mt-0.5">{d.getDate()}</span>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDayNoteModalDate(iso); }}
                          title="Σημειώσεις της ημέρας"
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40"
                        >
                          <Plus size={9} />
                        </button>
                      )}
                      {!isAdmin && hasAnyNote(iso) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDayNoteModalDate(iso); }}
                          title="Σημειώσεις της ημέρας"
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center"
                        >
                          <StickyNote size={10} />
                        </button>
                      )}
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

              const isKarayiannisStart = room.id === 12;
              const isVillaChristinaStart = room.id === 2;

              return (
                <React.Fragment key={room.id}>
                  {isKarayiannisStart && (
                    <div
                      className="flex items-center sticky z-[25] bg-stone-800 border-b border-amber-500/30"
                      style={{ top: HEADER_HEIGHT, height: SECTION_LABEL_HEIGHT }}
                    >
                      <span
                        className="sticky font-serif text-amber-300 text-xs sm:text-sm font-semibold tracking-wide uppercase"
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                      >
                        Karayiannis Villas
                      </span>
                    </div>
                  )}
                  {isVillaChristinaStart && (
                    <div
                      className="flex items-center sticky z-[25] bg-stone-800 border-b border-amber-500/30"
                      style={{ top: HEADER_HEIGHT, height: SECTION_LABEL_HEIGHT }}
                    >
                      <span
                        className="sticky font-serif text-amber-300 text-xs sm:text-sm font-semibold tracking-wide uppercase"
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                      >
                        Villa Christina
                      </span>
                    </div>
                  )}
                <div className="flex border-b border-stone-200" style={{ height: rowHeight }}>
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
                            <span className="truncate">{stay.type === 'blocked' ? stay.guestName : (stay.extraSpaces && stay.extraSpaces.trim() ? stay.extraSpaces : '—')}</span>
                            {stay.notes && stay.notes.trim() && <StickyNote size={10} className="flex-shrink-0 opacity-80" title={stay.notes} />}
                          </div>
                          <div className="text-[10px] sm:text-[11px] opacity-80 truncate font-mono">
                            {stay.type === 'blocked' ? 'Out of service' : paxLabel(stay.pax)}
                          </div>
                        </div>
                      );
                    })}

                    {viewDays.map((d) => {
                      const iso = toISO(d);
                      const idx = dayIndexBetween(viewStart, d);
                      const cellTasks = tasks.filter((t) => t.room_id === room.id && t.task_date === iso);
                      const badges = taskBadges(cellTasks);
                      const hasReservation = stays.some((s) => s.roomId === room.id && s.type === 'stay' && iso >= s.checkIn && iso < s.checkOut);
                      const showPlus = canManageTasks && hasReservation;
                      if (!badges && !showPlus) return null;
                      return (
                        <div
                          key={`task-${iso}`}
                          className="absolute z-10 flex items-end justify-between px-0.5 pb-0.5"
                          style={{ left: idx * colWidth, width: colWidth, top: 0, height: rowHeight, pointerEvents: 'none' }}
                        >
                          {badges ? (
                            <span
                              className="text-[11px] leading-none cursor-pointer"
                              style={{ pointerEvents: 'auto' }}
                              title={cellTasks.map((t) => TASK_LABELS[t.task_type] ?? t.task_type).join(', ')}
                              onClick={() => openTaskModal(room, iso)}
                            >
                              {badges}
                            </span>
                          ) : <span />}
                          {showPlus && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openTaskModal(room, iso); }}
                              title="Add housekeeping task"
                              className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-stone-900/70 text-white text-[9px] leading-none hover:bg-stone-900"
                              style={{ pointerEvents: 'auto' }}
                            >
                              +
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        )}

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

      {taskModal && (
        <TaskModal
          room={taskModal.room}
          date={taskModal.date}
          tasks={tasks}
          canEdit={canManageTasks}
          onClose={closeTaskModal}
        />
      )}

      {dayNoteModalDate && (
        <DayNoteModal
          date={dayNoteModalDate}
          karayiannisNote={noteFor(dayNoteModalDate, 'karayiannis')}
          christinaNote={noteFor(dayNoteModalDate, 'christina')}
          karayiannisChecklist={checklistFor(dayNoteModalDate, 'karayiannis')}
          christinaChecklist={checklistFor(dayNoteModalDate, 'christina')}
          isAdmin={isAdmin}
          canEdit={isAdmin}
          initials={initialsFor(profile)}
          userId={user.id}
          onSaveNote={(villa, text) => saveDayNote(dayNoteModalDate, villa, text)}
          onSaveChecklists={saveChecklistBatch}
          onClose={() => setDayNoteModalDate(null)}
        />
      )}
    </div>
  );
}