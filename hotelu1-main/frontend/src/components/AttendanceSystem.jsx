import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Coffee,
  CalendarDays,
  BarChart3,
  Download,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  TrendingUp,
  LogIn,
  LogOut,
  Sun,
  Shield,
  Check,
  X,
  RefreshCw,
  FileSpreadsheet,
  UserCheck,
  Timer,
  AlertCircle,
} from 'lucide-react';
// BUNDLE: exceljs (~3 MB minified) is loaded only when the user exports.
import { getAPI_URL } from '../utils/api';
import { loadRestaurantInfo } from '../utils/receiptPrint';

const API = () => getAPI_URL();
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const fmt = {
  time: (d) =>
    d
      ? new Date(d).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—',
  date: (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—',
  hours: (h) => (h != null && !isNaN(h) ? `${Number(h).toFixed(2)}h` : '—'),
  monthYear: (m, y) =>
    new Date(y, m - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
};

const STATUS_CONFIG = {
  present: {
    label: 'Present',
    color: '#10B981',
    bgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    Icon: CheckCircle2,
  },
  late: {
    label: 'Late',
    color: '#F59E0B',
    bgLight: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    Icon: AlertTriangle,
  },
  absent: {
    label: 'Absent',
    color: '#EF4444',
    bgLight: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    Icon: XCircle,
  },
  half_day: {
    label: 'Half Day',
    color: '#8B5CF6',
    bgLight: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    Icon: Coffee,
  },
  leave: {
    label: 'Leave',
    color: '#6366F1',
    bgLight: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
    Icon: CalendarDays,
  },
  holiday: {
    label: 'Holiday',
    color: '#EC4899',
    bgLight: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/60',
    Icon: Sun,
  },
};

const LEAVE_TYPES = [
  'sick',
  'casual',
  'earned',
  'unpaid',
  'maternity',
  'paternity',
  'emergency',
];

const SHIFT_OPTIONS = [
  { value: 'full_day', label: 'Full Day (9:00 AM - 5:00 PM)', hours: 8 },
  { value: 'morning', label: 'Morning Shift (6:00 AM - 2:00 PM)', hours: 8 },
  { value: 'afternoon', label: 'Afternoon Shift (2:00 PM - 10:00 PM)', hours: 8 },
  { value: 'evening', label: 'Evening Shift (4:00 PM - 12:00 AM)', hours: 8 },
  { value: 'night', label: 'Night Shift (10:00 PM - 6:00 AM)', hours: 8 },
  { value: 'flexible', label: 'Flexible Hours', hours: 8 },
];

/* ── Status Badge ──────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    bgLight: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    Icon: null,
  };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bgLight}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {cfg.label}
    </span>
  );
}

/* ── Live Digital Clock & Shift Control Widget ─── */
function LiveClockWidget({
  myStatus,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  loading,
}) {
  const [time, setTime] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState('full_day');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isIn = myStatus && myStatus.clock_in && !myStatus.clock_out;
  const isBreak = isIn && myStatus.break_start && !myStatus.break_end;

  // Live timer calculation
  const getElapsedSeconds = () => {
    if (!isIn || !myStatus.clock_in) return 0;
    const start = new Date(myStatus.clock_in).getTime();
    const now = time.getTime();
    return Math.max(0, Math.floor((now - start) / 1000));
  };

  const getBreakSeconds = () => {
    if (!isBreak || !myStatus.break_start) return 0;
    const start = new Date(myStatus.break_start).getTime();
    const now = time.getTime();
    return Math.max(0, Math.floor((now - start) / 1000));
  };

  const formatTimer = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const elapsedSec = getElapsedSeconds();
  const breakSec = getBreakSeconds();
  const scfg = myStatus ? STATUS_CONFIG[myStatus.status] : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F1E36] via-[#162B4D] to-[#0A1628] text-white p-6 sm:p-8 shadow-xl border border-blue-900/40">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left Column: Live Time & Date */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-blue-300 text-xs font-semibold tracking-wider uppercase">
            <Timer className="w-4 h-4 text-amber-400" />
            <span>Real-Time Attendance Clock</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight tabular-nums font-mono drop-shadow-sm">
            {time.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </h2>

          <p className="text-sm text-slate-300 mt-2 font-medium">
            {time.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          {/* Active status indicator */}
          <div className="mt-4 flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/15">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isIn
                    ? isBreak
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                {isIn
                  ? isBreak
                    ? 'Currently on Break'
                    : 'Shift Active / Clocked In'
                  : 'Not Clocked In Today'}
              </span>
            </div>

            {myStatus?.status && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${scfg?.color || '#94a3b8'}26`,
                  color: scfg?.color || '#94a3b8',
                }}
              >
                {scfg?.label || myStatus.status}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Shift Controls */}
        <div className="flex flex-col gap-3 min-w-[280px] max-w-md w-full bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl">
          {!isIn ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Shift
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="w-full bg-[#0d1b30] text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Optional shift notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0d1b30] text-white placeholder-slate-400 border border-white/20 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <button
                onClick={() => onClockIn(selectedShift, notes)}
                disabled={loading}
                className="w-full mt-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Clocking In...' : 'Clock In Now'}
              </button>
            </>
          ) : (
            <>
              {/* Working elapsed counter */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">
                    Working Duration
                  </p>
                  <p className="text-xl font-black font-mono text-emerald-200 mt-0.5">
                    {formatTimer(elapsedSec)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>In: {fmt.time(myStatus.clock_in)}</p>
                  <p className="text-emerald-400 font-medium">
                    Shift: {myStatus.shift || 'Full Day'}
                  </p>
                </div>
              </div>

              {isBreak && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">
                      Break Elapsed
                    </p>
                    <p className="text-lg font-black font-mono text-amber-200 mt-0.5">
                      {formatTimer(breakSec)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-300">
                    Since: {fmt.time(myStatus.break_start)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-1">
                {!isBreak ? (
                  <button
                    onClick={onBreakStart}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    Start Break
                  </button>
                ) : (
                  <button
                    onClick={onBreakEnd}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    End Break
                  </button>
                )}

                <button
                  onClick={onClockOut}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Clock Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modern Stat Card ──────────────────────────── */
function StatCard({ icon: Icon, label, value, color, bgLight, subtitle }) {
  return (
    <div className="bg-white dark:bg-[#111C35] border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3.5">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgLight}`}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
            {value}
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 truncate mt-0.5">
            {label}
          </p>
          {subtitle && (
            <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Attendance Table ──────────────────────────── */
function AttendanceTable({ records, isAdmin, onApprove, onEdit, onDelete }) {
  if (!records || !records.length) {
    return (
      <div className="text-center py-16 px-4">
        <CalendarDays className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
        <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          No attendance records found
        </h4>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 max-w-sm mx-auto">
          No entries match the selected filters. Use Clock In above or click "Add Record" to create manual entries.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="bg-gray-50/80 dark:bg-slate-900/60 text-gray-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-gray-200/80 dark:border-slate-800">
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4">Staff Member</th>
            <th className="py-3 px-4">Shift</th>
            <th className="py-3 px-4">Clock In</th>
            <th className="py-3 px-4">Clock Out</th>
            <th className="py-3 px-4 text-center">Net Hours</th>
            <th className="py-3 px-4 text-center">Overtime</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Approval</th>
            {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
          {records.map((r) => {
            return (
              <tr
                key={r.id}
                className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {fmt.date(r.date)}
                </td>

                <td className="py-3.5 px-4">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {r.user_name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 capitalize">
                    {r.user_role}
                  </p>
                </td>

                <td className="py-3.5 px-4 capitalize text-gray-600 dark:text-slate-300">
                  {r.shift ? r.shift.replace('_', ' ') : 'Full Day'}
                </td>

                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                  {fmt.time(r.clock_in)}
                </td>

                <td className="py-3.5 px-4 text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                  {fmt.time(r.clock_out)}
                </td>

                <td className="py-3.5 px-4 text-center font-bold whitespace-nowrap text-gray-900 dark:text-white">
                  {fmt.hours(r.net_hours)}
                </td>

                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                  {r.overtime_hours > 0 ? (
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      +{fmt.hours(r.overtime_hours)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-slate-600">—</span>
                  )}
                </td>

                <td className="py-3.5 px-4">
                  <StatusBadge status={r.status} />
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  {r.is_approved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <Shield className="w-3.5 h-3.5" />
                      Approved
                    </span>
                  ) : isAdmin ? (
                    <button
                      onClick={() => onApprove(r.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Approve
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      Pending
                    </span>
                  )}
                </td>

                {isAdmin && (
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(r)}
                        title="Edit Record"
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(r.id)}
                        title="Delete Record"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Record Modal (Add/Edit) ───────────────────── */
function RecordModal({ record, staff, onClose, onSave }) {
  const isEdit = !!(record && record.id);
  const [form, setForm] = useState({
    user_id: isEdit ? String(record.user_id) : '',
    user_name: isEdit ? record.user_name : '',
    user_role: isEdit ? record.user_role : '',
    date: isEdit ? record.date : new Date().toISOString().slice(0, 10),
    clock_in: isEdit && record.clock_in ? new Date(record.clock_in).toISOString().slice(0, 16) : '',
    clock_out: isEdit && record.clock_out ? new Date(record.clock_out).toISOString().slice(0, 16) : '',
    status: isEdit ? record.status : 'present',
    leave_type: isEdit ? record.leave_type || '' : '',
    notes: isEdit ? record.notes || '' : '',
    shift: isEdit ? record.shift || 'full_day' : 'full_day',
    expected_hours: isEdit ? record.expected_hours || 8 : 8,
    id: isEdit ? record.id : undefined,
  });
  const [saving, setSaving] = useState(false);

  const handleUserChange = (uid) => {
    const u = staff.find((s) => String(s.id) === String(uid));
    setForm((p) => ({
      ...p,
      user_id: uid,
      user_name: u ? u.name : p.user_name,
      user_role: u ? u.role : p.user_role,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-gray-800 dark:text-slate-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';
  const labelClass =
    'block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111C35] border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Attendance Record' : 'Add Manual Attendance Record'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Staff Member *</label>
            {staff && staff.length > 0 ? (
              <select
                required
                value={form.user_id}
                onChange={(e) => handleUserChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select staff member...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                type="text"
                placeholder="Staff name"
                value={form.user_name}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    user_name: e.target.value,
                    user_id: p.user_id || '1',
                  }))
                }
                className={inputClass}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Shift</label>
              <select
                value={form.shift}
                onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))}
                className={inputClass}
              >
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Clock In Time</label>
              <input
                type="datetime-local"
                value={form.clock_in}
                onChange={(e) => setForm((p) => ({ ...p, clock_in: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Clock Out Time</label>
              <input
                type="datetime-local"
                value={form.clock_out}
                onChange={(e) => setForm((p) => ({ ...p, clock_out: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Attendance Status *</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className={inputClass}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            {form.status === 'leave' && (
              <div>
                <label className={labelClass}>Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select leave type...</option>
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt.charAt(0).toUpperCase() + lt.slice(1)} Leave
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notes / Remarks</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any supervisor remarks or notes..."
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-900/30 transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main AttendanceSystem Component ───────────── */
const AttendanceSystem = ({ currentUser }) => {
  const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['admin', 'manager', 'franchise'].includes(user.role);

  const [tab, setTab] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [myStatus, setMyStatus] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
    user_id: '',
    search: '',
  });

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchMyStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API()}/api/attendance/me/status`, {
        headers: authHeaders(),
      });
      if (r.ok) setMyStatus(await r.json());
    } catch (e) {
      console.error('fetchMyStatus error:', e);
    }
  }, []);

  const fetchTodayRecords = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API()}/api/attendance/today`, {
        headers: authHeaders(),
      });
      if (r.ok) setTodayRecords(await r.json());
    } catch (e) {
      console.error('fetchTodayRecords error:', e);
    }
  }, [isAdmin]);

  const fetchSummary = useCallback(async () => {
    try {
      const p = new URLSearchParams({
        month: String(filters.month),
        year: String(filters.year),
      });
      const r = await fetch(`${API()}/api/attendance/summary?${p}`, {
        headers: authHeaders(),
      });
      if (r.ok) setSummary(await r.json());
    } catch (e) {
      console.error('fetchSummary error:', e);
    }
  }, [filters.month, filters.year]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        month: String(filters.month),
        year: String(filters.year),
      });
      if (filters.status) p.set('status', filters.status);
      if (filters.user_id && isAdmin) p.set('user_id', filters.user_id);
      const r = await fetch(`${API()}/api/attendance?${p}`, {
        headers: authHeaders(),
      });
      if (r.ok) {
        let data = await r.json();
        if (filters.search) {
          const q = filters.search.toLowerCase();
          data = data.filter(
            (d) =>
              (d.user_name || '').toLowerCase().includes(q) ||
              (d.date || '').includes(q) ||
              (d.user_role || '').toLowerCase().includes(q)
          );
        }
        setRecords(data);
      }
    } catch (e) {
      console.error('fetchRecords error:', e);
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  const fetchStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch(`${API()}/api/users`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        const staffList = Array.isArray(d) ? d : d.users || [];
        setStaff(staffList);
      }
    } catch (e) {
      console.error('fetchStaff error:', e);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchMyStatus();
    fetchTodayRecords();
    fetchSummary();
    fetchRecords();
    fetchStaff();
  }, []); // eslint-disable-line

  useEffect(() => {
    fetchSummary();
    fetchRecords();
  }, [filters.month, filters.year, filters.status, filters.user_id]); // eslint-disable-line

  const clockIn = async (shift, notes) => {
    setActionLoading(true);
    try {
      const r = await fetch(`${API()}/api/attendance/clock-in`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ shift, notes }),
      });
      const d = await r.json();
      if (r.ok) {
        showToast(
          d.isLate
            ? 'Clocked in successfully (Marked Late as shift started)'
            : 'Clocked in successfully!'
        );
        fetchMyStatus();
        fetchTodayRecords();
        fetchSummary();
        fetchRecords();
      } else {
        showToast(d.message || 'Error clocking in', 'error');
      }
    } catch {
      showToast('Network error clocking in', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const clockOut = async () => {
    if (!window.confirm('Are you sure you want to clock out for today?')) return;
    setActionLoading(true);
    try {
      const r = await fetch(`${API()}/api/attendance/clock-out`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        showToast(
          `Clocked out! Total: ${d.summary?.totalHours || 0}h (Net: ${d.summary?.netHours || 0}h)`
        );
        fetchMyStatus();
        fetchTodayRecords();
        fetchSummary();
        fetchRecords();
      } else {
        showToast(d.message || 'Error clocking out', 'error');
      }
    } catch {
      showToast('Network error clocking out', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const startBreak = async () => {
    setActionLoading(true);
    try {
      const r = await fetch(`${API()}/api/attendance/break-start`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        showToast('Break started. Enjoy your break!');
        fetchMyStatus();
      } else {
        showToast(d.message || 'Error starting break', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const endBreak = async () => {
    setActionLoading(true);
    try {
      const r = await fetch(`${API()}/api/attendance/break-end`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        showToast('Break ended. Welcome back!');
        fetchMyStatus();
      } else {
        showToast(d.message || 'Error ending break', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const r = await fetch(`${API()}/api/attendance/${id}/approve`, {
        method: 'PUT',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        showToast('Record approved successfully');
        fetchRecords();
        fetchTodayRecords();
      } else {
        showToast(d.message || 'Error approving', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?'))
      return;
    try {
      const r = await fetch(`${API()}/api/attendance/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (r.ok) {
        showToast('Attendance record deleted');
        fetchRecords();
        fetchTodayRecords();
        fetchSummary();
      } else {
        showToast(d.message || 'Error deleting', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleSaveRecord = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id
      ? `${API()}/api/attendance/${form.id}`
      : `${API()}/api/attendance`;
    try {
      const staffMember = staff.find((s) => String(s.id) === String(form.user_id));
      const payload = {
        ...form,
        user_name: staffMember ? staffMember.name : form.user_name,
        user_role: staffMember ? staffMember.role : form.user_role,
      };
      const r = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        showToast(form.id ? 'Attendance updated' : 'Attendance record created');
        setModal(null);
        fetchRecords();
        fetchTodayRecords();
        fetchSummary();
      } else {
        showToast(d.message || 'Error saving record', 'error');
      }
    } catch {
      showToast('Network error saving attendance', 'error');
    }
  };

  /* ── Export Professional Excel (.xlsx) ────────── */
  const handleExportExcel = async () => {
    if (!records.length) {
      showToast('No records to export', 'error');
      return;
    }
    const ExcelJS = (await import('exceljs')).default;
    const info = loadRestaurantInfo();
    const period = fmt.monthYear(filters.month, filters.year);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = info.name || 'Hotel POS Attendance';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance Ledger');

    // Title Row
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${(info.name || 'HOTEL POS').toUpperCase()} — STAFF ATTENDANCE LEDGER`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1E36' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 36;

    // Subtitle / Period
    sheet.mergeCells('A2:L2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Period: ${period} | Exported: ${new Date().toLocaleString('en-IN')} | Total Records: ${records.length}`;
    subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Headers
    const headers = [
      'Date',
      'Staff Name',
      'Role',
      'Shift',
      'Clock In',
      'Clock Out',
      'Break (h)',
      'Net Hours (h)',
      'Overtime (h)',
      'Status',
      'Approved',
      'Notes',
    ];

    sheet.getRow(4).values = headers;
    const headerRow = sheet.getRow(4);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    let totalNetHours = 0;
    let totalOvertimeHours = 0;

    records.forEach((r, idx) => {
      const net = Number(r.net_hours || 0);
      const ot = Number(r.overtime_hours || 0);
      totalNetHours += net;
      totalOvertimeHours += ot;

      const rowValues = [
        r.date,
        r.user_name,
        r.user_role,
        r.shift ? r.shift.replace('_', ' ') : 'full day',
        r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
        r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
        Number(r.break_hours || 0).toFixed(2),
        net.toFixed(2),
        ot.toFixed(2),
        (r.status || 'present').toUpperCase(),
        r.is_approved ? 'YES' : 'NO',
        r.notes || '',
      ];

      const row = sheet.addRow(rowValues);
      row.height = 20;

      const isEven = idx % 2 === 0;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 5, 6, 7, 8, 9, 10, 11].includes(colNum) ? 'center' : 'left',
        };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Summary Total Row
    const summaryRow = sheet.addRow([
      'TOTAL',
      `${records.length} records`,
      '',
      '',
      '',
      '',
      '',
      totalNetHours.toFixed(2),
      totalOvertimeHours.toFixed(2),
      '',
      '',
      '',
    ]);
    summaryRow.height = 24;
    summaryRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F1E36' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'double', color: { argb: 'FF0F1E36' } },
        bottom: { style: 'double', color: { argb: 'FF0F1E36' } },
      };
    });

    // Set column widths
    sheet.columns = [
      { width: 14 },
      { width: 20 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 24 },
    ];

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${period.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Professional Excel (.xlsx) file downloaded!');
  };

  /* ── Export Clean CSV ──────────────────────────── */
  const exportCSV = () => {
    if (!records.length) {
      showToast('No records to export', 'error');
      return;
    }
    const clean = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const H = [
      'Date',
      'Staff Name',
      'Role',
      'Shift',
      'Clock In',
      'Clock Out',
      'Break Hours',
      'Net Hours',
      'Overtime Hours',
      'Status',
      'Approved',
      'Notes',
    ];
    const rows = records.map((r) => [
      clean(r.date),
      clean(r.user_name),
      clean(r.user_role),
      clean(r.shift),
      clean(r.clock_in ? new Date(r.clock_in).toLocaleString('en-IN') : ''),
      clean(r.clock_out ? new Date(r.clock_out).toLocaleString('en-IN') : ''),
      clean(r.break_hours || 0),
      clean(r.net_hours || 0),
      clean(r.overtime_hours || 0),
      clean(r.status),
      clean(r.is_approved ? 'Yes' : 'No'),
      clean(r.notes || ''),
    ]);
    const csv = [H.map(clean).join(','), ...rows.map((row) => row.join(','))].join(
      '\r\n'
    );
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Attendance_${fmt.monthYear(filters.month, filters.year).replace(/\s+/g, '_')}.csv`;
    a.click();
    showToast('CSV exported successfully!');
  };

  const prevMonth = () =>
    setFilters((p) => {
      let m = p.month - 1;
      let y = p.year;
      if (m < 1) {
        m = 12;
        y--;
      }
      return { ...p, month: m, year: y };
    });

  const nextMonth = () =>
    setFilters((p) => {
      let m = p.month + 1;
      let y = p.year;
      if (m > 12) {
        m = 1;
        y++;
      }
      return { ...p, month: m, year: y };
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] p-4 sm:p-6 lg:p-8 text-gray-800 dark:text-slate-100 transition-colors duration-200">
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Attendance &amp; Shift Management
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 ml-1">
            Track real-time staff clock-ins, shift breaks, overtime hours, and monthly payroll attendance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <button
                onClick={handleExportExcel}
                title="Export Formatted Excel (.xlsx)"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111C35] text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 text-xs sm:text-sm font-semibold shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              <button
                onClick={exportCSV}
                title="Export Clean CSV"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#111C35] text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 text-xs sm:text-sm font-semibold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={() => setModal({})}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-900/30 transition active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Record
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200/80 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            tab === 'dashboard'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Timer className="w-4 h-4" />
          My Clock &amp; Overview
        </button>

        {isAdmin && (
          <button
            onClick={() => setTab('today')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'today'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Today's Live Roster ({todayRecords.length})
          </button>
        )}

        <button
          onClick={() => setTab('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            tab === 'records'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Monthly Attendance Ledger
        </button>
      </div>

      {/* ── TAB 1: DASHBOARD & CLOCK IN ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          {/* Live Clock Widget */}
          <LiveClockWidget
            myStatus={myStatus}
            onClockIn={clockIn}
            onClockOut={clockOut}
            onBreakStart={startBreak}
            onBreakEnd={endBreak}
            loading={actionLoading}
          />

          {/* Month Selector Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-[#111C35] border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 px-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white px-2">
                {fmt.monthYear(filters.month, filters.year)}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
              Summary for current month period
            </p>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CheckCircle2}
              label="Present Days"
              value={summary.present || 0}
              color="#10B981"
              bgLight="bg-emerald-50 dark:bg-emerald-950/40"
            />
            <StatCard
              icon={AlertTriangle}
              label="Late Arrivals"
              value={summary.late || 0}
              color="#F59E0B"
              bgLight="bg-amber-50 dark:bg-amber-950/40"
            />
            <StatCard
              icon={XCircle}
              label="Absent Days"
              value={summary.absent || 0}
              color="#EF4444"
              bgLight="bg-rose-50 dark:bg-rose-950/40"
            />
            <StatCard
              icon={CalendarDays}
              label="Approved Leaves"
              value={summary.on_leave || 0}
              color="#6366F1"
              bgLight="bg-indigo-50 dark:bg-indigo-950/40"
            />
            <StatCard
              icon={Clock}
              label="Total Net Hours"
              value={`${summary.total_hours || 0}h`}
              color="#0EA5E9"
              bgLight="bg-sky-50 dark:bg-sky-950/40"
            />
            <StatCard
              icon={TrendingUp}
              label="Total Overtime"
              value={`${summary.total_overtime || 0}h`}
              color="#D946EF"
              bgLight="bg-fuchsia-50 dark:bg-fuchsia-950/40"
            />
            <StatCard
              icon={Coffee}
              label="Half Days"
              value={summary.half_day || 0}
              color="#8B5CF6"
              bgLight="bg-purple-50 dark:bg-purple-950/40"
            />
            <StatCard
              icon={BarChart3}
              label="Total Records"
              value={summary.total || 0}
              color="#64748B"
              bgLight="bg-slate-100 dark:bg-slate-800"
            />
          </div>
        </div>
      )}

      {/* ── TAB 2: TODAY'S LIVE ROSTER (ADMIN) ── */}
      {tab === 'today' && isAdmin && (
        <div className="bg-white dark:bg-[#111C35] rounded-2xl border border-gray-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 sm:p-5 border-b border-gray-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Today's Active Roster
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {fmt.date(new Date().toISOString())} · {todayRecords.length} staff members checked in
              </p>
            </div>
            <button
              onClick={fetchTodayRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Roster
            </button>
          </div>

          <AttendanceTable
            records={todayRecords}
            isAdmin={isAdmin}
            onApprove={handleApprove}
            onEdit={(r) => setModal(r)}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* ── TAB 3: MONTHLY ATTENDANCE LEDGER ── */}
      {tab === 'records' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-[#111C35] rounded-2xl border border-gray-200/80 dark:border-slate-800/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff name or date..."
                  value={filters.search}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs sm:text-sm text-gray-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-1">
                <button
                  onClick={prevMonth}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                </button>
                <span className="text-xs font-bold text-gray-900 dark:text-white px-2 whitespace-nowrap">
                  {fmt.monthYear(filters.month, filters.year)}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs sm:text-sm text-gray-800 dark:text-slate-100 outline-none"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>

              {/* Staff Filter (Admin only) */}
              {isAdmin && staff.length > 0 && (
                <select
                  value={filters.user_id}
                  onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs sm:text-sm text-gray-800 dark:text-slate-100 outline-none"
                >
                  <option value="">All Staff</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={fetchRecords}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
              >
                <Filter className="w-3.5 h-3.5" />
                Apply
              </button>
            </div>
          </div>

          {/* Records Table Card */}
          <div className="bg-white dark:bg-[#111C35] rounded-2xl border border-gray-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200/80 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {records.length} Attendance Records Found
              </span>
              {loading && (
                <span className="text-xs text-indigo-500 flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </span>
              )}
            </div>

            <AttendanceTable
              records={records}
              isAdmin={isAdmin}
              onApprove={handleApprove}
              onEdit={(r) => setModal(r)}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}

      {/* ── Modal (Add / Edit Record) ── */}
      {modal !== null && (
        <RecordModal
          record={modal && modal.id ? modal : null}
          staff={staff}
          onClose={() => setModal(null)}
          onSave={handleSaveRecord}
        />
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-white text-xs sm:text-sm font-semibold max-w-sm animate-slide-up ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default AttendanceSystem;
