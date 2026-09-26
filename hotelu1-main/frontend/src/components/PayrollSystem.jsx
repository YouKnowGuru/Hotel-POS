import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, FileText, Settings, CheckCircle, Search,
  Trash2, Eye, Banknote, ArrowUpRight, ArrowDownRight, Zap, RefreshCw,
  Printer, X, Save, Award, TrendingDown, Wallet,
  PlusCircle, Edit, Calendar, User, Clock, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { getAPI_URL } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';

/* ── Design tokens ──────────────────────────────────────────────── */
const NAVY = '#1E3A8A';
const GOLD = '#D4A017';

const getGlass = (isDark) => ({
  background: isDark ? 'rgba(15, 29, 64, 0.70)' : '#FFFFFF',
  backdropFilter: 'blur(20px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
  border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #E2E8F0',
  borderRadius: 20,
  boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.30)' : '0 4px 18px rgba(0,0,0,0.04)',
});

const fmt = (v) =>
  `Nu. ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (v) => {
  const n = Number(v || 0);
  if (n >= 100000) return `Nu. ${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `Nu. ${(n / 1000).toFixed(1)}K`;
  return `Nu. ${n.toFixed(0)}`;
};

const STATUS_STYLES = {
  draft:    { bg: 'rgba(148,163,184,0.15)', color: '#94A3B8', label: 'Draft' },
  pending:  { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24', label: 'Pending' },
  approved: { bg: 'rgba(16,185,129,0.15)',  color: '#10B981', label: 'Approved' },
  paid:     { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6', label: 'Paid' },
  on_hold:  { bg: 'rgba(239,68,68,0.15)',   color: '#EF4444', label: 'On Hold' },
};

const ROLE_COLORS = {
  admin: '#D4A017', manager: '#3B82F6', waiter: '#10B981',
  cashier: '#8B5CF6',
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/* ── Reusable atoms ─────────────────────────────────────────────── */
const StatusBadge = ({ status, isDark = true }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span style={{
      background: isDark ? s.bg : (status === 'draft' ? '#F1F5F9' : s.bg),
      color: s.color,
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      border: isDark ? 'none' : `1px solid ${s.color}35`,
    }}>
      {s.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, accent = GOLD, isDark = true }) => (
  <div style={{ ...getGlass(isDark), padding: '20px 22px', minWidth: 0, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${accent}15`, filter: 'blur(20px)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accent}30` }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <span style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: '-0.02em', marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: isDark ? '#64748B' : '#94A3B8' }}>{sub}</div>}
  </div>
);

const ActionBtn = ({ title, onClick, color, icon: Icon, isDark = true }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 28, height: 28, borderRadius: 8,
      border: `1px solid ${color}40`,
      background: isDark ? `${color}18` : `${color}14`,
      color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
  >
    <Icon size={13} />
  </button>
);

const InputField = ({ label, value, onChange, type = 'text', prefix, isDark = true, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
    <div style={{ position: 'relative' }}>
      {prefix && (
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', zIndex: 1, pointerEvents: 'none' }}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: `9px 12px 9px ${prefix ? 32 : 12}px`,
          background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
          border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
          borderRadius: 10,
          color: isDark ? '#F8FAFC' : '#0F172A',
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.15s ease',
        }}
      />
    </div>
  </div>
);

/* ── Payslip Modal ──────────────────────────────────────────────── */
const PayslipModal = ({ record: r, onClose, isDark = true }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const css = `body{font-family:Arial,sans-serif;margin:20px;color:#1e293b}
      .hdr{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px;display:flex;justify-content:space-between}
      .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
      .earn{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px}
      .ded{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #e2e8f0;font-size:13px}
      .net{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
      .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}`;
    w.document.write(`<html><head><title>Payslip - ${r.user_name}</title><style>${css}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
    w.close();
  };

  const earnings = [
    { label: 'Basic Salary', val: r.basic_salary },
    { label: 'Overtime Pay', val: r.overtime_pay },
    { label: 'HRA', val: r.hra },
    { label: 'Transport', val: r.transport },
    { label: 'Meals', val: r.meals },
    { label: 'Medical', val: r.medical },
    { label: 'Other Allowances', val: r.other_allowances },
    { label: 'Performance Bonus', val: r.performance_bonus },
    { label: 'Festival Bonus', val: r.festival_bonus },
    { label: 'Tips Shared', val: r.tips_shared },
  ].filter((x) => parseFloat(x.val || 0) > 0);

  const deductions = [
    { label: 'Tax', val: r.tax },
    { label: 'Provident Fund', val: r.provident_fund },
    { label: 'Insurance', val: r.insurance },
    { label: 'Advance Deduction', val: r.advance_deduction },
    { label: 'Late Penalty', val: r.late_deduction },
    { label: 'Absent Deduction', val: r.absent_deduction },
    { label: 'Other Deductions', val: r.other_deductions },
  ].filter((x) => parseFloat(x.val || 0) > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh', overflow: 'auto', borderRadius: 24,
        background: isDark ? '#0B1838' : '#FFFFFF',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E2E8F0',
        boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.12)',
        color: isDark ? '#FFFFFF' : '#0F172A',
      }}>
        {/* Header bar */}
        <div style={{
          padding: '20px 24px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0,
          background: isDark ? '#0B1838' : '#FFFFFF',
          zIndex: 10,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A' }}>
              Payslip — {r.user_name}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
              {r.pay_period_label || `${r.pay_period_start} to ${r.pay_period_end}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handlePrint} style={{ padding: '8px 16px', background: `linear-gradient(135deg,${GOLD},#A16207)`, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable section */}
        <div ref={printRef} style={{ padding: 24 }}>
          {/* Company block */}
          <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius: 14, padding: '20px 28px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff' }}>PAYSLIP</h1>
              <p style={{ margin: '2px 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                Period: {r.pay_period_label || `${r.pay_period_start} to ${r.pay_period_end}`}
              </p>
              <p style={{ margin: '2px 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                Generated: {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>{r.user_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>
                {r.user_role}{r.department ? ` · ${r.department}` : ''}
              </div>
              <StatusBadge status={r.status} isDark={true} />
            </div>
          </div>

          {/* Attendance summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Working Days', val: r.total_working_days, color: null },
              { label: 'Present',      val: r.days_present,       color: '#10B981' },
              { label: 'Absent',       val: r.days_absent,        color: '#EF4444' },
              { label: 'Leave',        val: r.days_leave,         color: '#F59E0B' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
                borderRadius: 12, padding: '12px 16px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: color || (isDark ? '#FFFFFF' : '#0F172A') }}>{val || 0}</div>
                <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Earnings / Deductions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{
              background: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF4',
              border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #BBF7D0',
              borderRadius: 14, padding: '16px 20px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Earnings</div>
              {earnings.map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: isDark ? '1px dashed rgba(255,255,255,0.07)' : '1px dashed #E2E8F0', fontSize: 13 }}>
                  <span style={{ color: isDark ? '#94A3B8' : '#475569' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: isDark ? '#FFFFFF' : '#0F172A' }}>{fmt(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: isDark ? '2px solid rgba(16,185,129,0.3)' : '2px solid #86EFAC', fontWeight: 800, color: '#10B981', fontSize: 14 }}>
                <span>Gross Salary</span><span>{fmt(r.gross_salary)}</span>
              </div>
            </div>

            <div style={{
              background: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
              border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid #FECACA',
              borderRadius: 14, padding: '16px 20px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Deductions</div>
              {deductions.map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: isDark ? '1px dashed rgba(255,255,255,0.07)' : '1px dashed #E2E8F0', fontSize: 13 }}>
                  <span style={{ color: isDark ? '#94A3B8' : '#475569' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#EF4444' }}>-{fmt(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: isDark ? '2px solid rgba(239,68,68,0.3)' : '2px solid #FCA5A5', fontWeight: 800, color: '#EF4444', fontSize: 14 }}>
                <span>Total Deductions</span><span>-{fmt(r.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net salary */}
          <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius: 16, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Net Salary Payable</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.03em' }}>{fmt(r.net_salary)}</div>
            </div>
            {r.payment_method && (
              <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                <div>Method: <b style={{ color: '#fff', textTransform: 'capitalize' }}>{r.payment_method.replace('_', ' ')}</b></div>
                {r.payment_date && <div>Paid: <b style={{ color: '#fff' }}>{r.payment_date}</b></div>}
                {r.payment_reference && <div>Ref: <b style={{ color: '#fff' }}>{r.payment_reference}</b></div>}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
            Computer-generated payslip. No signature required.
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Staff Config Drawer ─────────────────────────────────────────── */
const StaffConfigDrawer = ({ users, config, onSave, onClose, isDark = true }) => {
  const [local, setLocal] = useState(() => {
    const c = {};
    users.forEach((u) => {
      c[u.id] = {
        basic_salary: 0, hourly_rate: 0, overtime_rate: 1.5,
        hra: 0, transport: 0, meals: 0, medical: 0, other_allowances: 0,
        tax_percent: 0, pf_percent: 5, insurance: 0,
        department: '', performance_bonus: 0,
        ...(config[u.id] || {}),
      };
    });
    return c;
  });
  const [selUser, setSelUser] = useState(users[0]?.id || null);
  const upd = (uid, field, val) =>
    setLocal((p) => ({ ...p, [uid]: { ...p[uid], [field]: val } }));

  const estimate = (c) => {
    const allwc = (+c.hra||0)+(+c.transport||0)+(+c.meals||0)+(+c.medical||0)+(+c.other_allowances||0);
    const gross = (+c.basic_salary||0) + allwc + (+c.performance_bonus||0);
    const ded = gross*(+c.tax_percent||0)/100 + gross*(+c.pf_percent||0)/100 + (+c.insurance||0);
    return { gross, ded, net: gross - ded };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div style={{
        width: '100%', maxWidth: 720,
        background: isDark ? '#0B1838' : '#FFFFFF',
        borderLeft: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        color: isDark ? '#FFFFFF' : '#0F172A',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          background: isDark ? 'transparent' : '#F8FAFC',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A' }}>Salary Configuration</h2>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Set base pay, allowances & deduction rates per employee</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* User list */}
          <div style={{
            width: 190,
            borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
            overflow: 'auto', padding: '12px 8px', flexShrink: 0,
            background: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC',
          }}>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelUser(u.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 10, marginBottom: 4,
                  background: selUser === u.id ? (isDark ? 'rgba(212,160,23,0.18)' : '#FEF3C7') : 'transparent',
                  border: selUser === u.id ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 2 }}>{u.name}</div>
                <div style={{ fontSize: 10, textTransform: 'capitalize', color: ROLE_COLORS[u.role] || (isDark ? '#94A3B8' : '#64748B') }}>{u.role}</div>
              </button>
            ))}
          </div>

          {/* Form */}
          {selUser && local[selUser] && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: isDark ? '#0B1838' : '#FFFFFF' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 16 }}>
                {users.find((u) => u.id === selUser)?.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <InputField label="Department"     value={local[selUser].department}    onChange={(v) => upd(selUser,'department',v)} isDark={isDark} />
                <InputField label="Basic Salary"   value={local[selUser].basic_salary}  onChange={(v) => upd(selUser,'basic_salary',v)}  type="number" prefix="Nu." isDark={isDark} />
                <InputField label="Hourly Rate"    value={local[selUser].hourly_rate}   onChange={(v) => upd(selUser,'hourly_rate',v)}   type="number" prefix="Nu." isDark={isDark} />
                <InputField label="OT Multiplier"  value={local[selUser].overtime_rate} onChange={(v) => upd(selUser,'overtime_rate',v)} type="number" prefix="x"   isDark={isDark} />

                <div style={{ gridColumn: '1/-1', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0', paddingTop: 10, fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase' }}>Allowances</div>
                <InputField label="HRA"              value={local[selUser].hra}              onChange={(v) => upd(selUser,'hra',v)}              type="number" prefix="Nu." isDark={isDark} />
                <InputField label="Transport"         value={local[selUser].transport}         onChange={(v) => upd(selUser,'transport',v)}         type="number" prefix="Nu." isDark={isDark} />
                <InputField label="Meals"             value={local[selUser].meals}             onChange={(v) => upd(selUser,'meals',v)}             type="number" prefix="Nu." isDark={isDark} />
                <InputField label="Medical"           value={local[selUser].medical}           onChange={(v) => upd(selUser,'medical',v)}           type="number" prefix="Nu." isDark={isDark} />
                <InputField label="Other Allowances"  value={local[selUser].other_allowances}  onChange={(v) => upd(selUser,'other_allowances',v)}  type="number" prefix="Nu." isDark={isDark} />

                <div style={{ gridColumn: '1/-1', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0', paddingTop: 10, fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>Deductions</div>
                <InputField label="Tax %"            value={local[selUser].tax_percent}   onChange={(v) => upd(selUser,'tax_percent',v)}   type="number" prefix="%" isDark={isDark} />
                <InputField label="Provident Fund %"  value={local[selUser].pf_percent}    onChange={(v) => upd(selUser,'pf_percent',v)}    type="number" prefix="%" isDark={isDark} />
                <InputField label="Insurance (fixed)" value={local[selUser].insurance}     onChange={(v) => upd(selUser,'insurance',v)}     type="number" prefix="Nu." isDark={isDark} />

                <div style={{ gridColumn: '1/-1', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0', paddingTop: 10, fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>Default Monthly Bonus</div>
                <InputField label="Performance Bonus" value={local[selUser].performance_bonus} onChange={(v) => upd(selUser,'performance_bonus',v)} type="number" prefix="Nu." isDark={isDark} />
              </div>

              {/* Live estimate */}
              {(() => {
                const e = estimate(local[selUser]);
                return (
                  <div style={{
                    marginTop: 20,
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
                    borderRadius: 14, padding: 16
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 10 }}>MONTHLY ESTIMATE (excl. OT)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      {[
                        { l: 'Gross', v: e.gross, c: '#10B981', bg: isDark ? '#10B98115' : '#ECFDF5', border: isDark ? '#10B98130' : '#A7F3D0' },
                        { l: 'Deductions', v: e.ded, c: '#EF4444', bg: isDark ? '#EF444415' : '#FEF2F2', border: isDark ? '#EF444430' : '#FECACA' },
                        { l: 'Net', v: e.net, c: GOLD, bg: isDark ? '#D4A01715' : '#FFFBEB', border: isDark ? '#D4A01730' : '#FDE68A' },
                      ].map(({ l, v, c, bg, border }) => (
                        <div key={l} style={{ textAlign: 'center', padding: 10, background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{fmtShort(v)}</div>
                          <div style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
          background: isDark ? 'transparent' : '#F8FAFC',
        }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={() => onSave(local)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${GOLD},#A16207)`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(212,160,23,0.3)' }}>
            <Save size={14} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Pay Modal ───────────────────────────────────────────────────── */
const PayModal = ({ record, onPay, onClose, isDark = true }) => {
  const [method, setMethod] = useState('bank_transfer');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: isDark ? '#0B1838' : '#FFFFFF',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E2E8F0',
        borderRadius: 20, padding: 28,
        boxShadow: isDark ? '0 25px 50px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.15)',
        color: isDark ? '#FFFFFF' : '#0F172A',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A' }}>Mark as Paid</h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
          {record.user_name} — <strong style={{ color: GOLD }}>{fmt(record.net_salary)}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{
                width: '100%', marginTop: 4, padding: '9px 12px',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                borderRadius: 10,
                color: isDark ? '#FFFFFF' : '#0F172A',
                fontSize: 13, outline: 'none',
              }}
            >
              {['cash','bank_transfer','cheque','upi','other'].map((m) => (
                <option key={m} value={m} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {m.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <InputField label="Payment Reference" value={ref} onChange={setRef} isDark={isDark} />
          <InputField label="Payment Date" value={date} onChange={setDate} type="date" isDark={isDark} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={() => onPay({ payment_method: method, payment_reference: ref, payment_date: date })} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#1E40AF)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Banknote size={14} /> Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Generate Modal ──────────────────────────────────────────────── */
const GenerateModal = ({ onGenerate, onClose, isDark = true }) => {
  const now = new Date();
  const [year,  setYear]  = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [busy,  setBusy]  = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: isDark ? '#0B1838' : '#FFFFFF',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E2E8F0',
        borderRadius: 20, padding: 28,
        boxShadow: isDark ? '0 25px 50px rgba(0,0,0,0.8)' : '0 20px 40px rgba(0,0,0,0.15)',
        color: isDark ? '#FFFFFF' : '#0F172A',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(212,160,23,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} style={{ color: GOLD }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A' }}>Auto-Generate Payroll</h3>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Reads attendance to compute salaries</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{
                width: '100%', marginTop: 4, boxSizing: 'border-box', padding: '9px 12px',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                borderRadius: 10, color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 13, outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                width: '100%', marginTop: 4, padding: '9px 12px',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                borderRadius: 10, color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 13, outline: 'none'
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{
          background: isDark ? 'rgba(251,191,36,0.08)' : '#FFFBEB',
          border: isDark ? '1px solid rgba(251,191,36,0.2)' : '1px solid #FDE68A',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20
        }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 700, marginBottom: 6 }}>⚡ What this does</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: isDark ? '#94A3B8' : '#475569', lineHeight: 1.8 }}>
            <li>Reads attendance for the selected period</li>
            <li>Applies per-staff salary config (basic, allowances, rates)</li>
            <li>Auto-calculates overtime, late & absent deductions</li>
            <li>Skips employees already processed for this period</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button disabled={busy} onClick={async () => { setBusy(true); await onGenerate(year, month); setBusy(false); }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${GOLD},#A16207)`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}>
            <Zap size={14} /> {busy ? 'Generating…' : 'Generate Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Manual Payroll Modal (Create / Edit) ────────────────────────── */
const ManualPayrollModal = ({ users, staffConfig, initialData, onSave, onClose, isDark = true }) => {
  const isEdit = Boolean(initialData?.id);
  const now = new Date();

  const getDates = (y, m) => {
    const yr = parseInt(y);
    const mo = parseInt(m);
    const start = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const lastDay = new Date(yr, mo, 0).getDate();
    const end = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const label = `${MONTHS[mo - 1]} ${yr}`;
    return { start, end, label, daysInMonth: lastDay };
  };

  const defaultDates = getDates(now.getFullYear(), now.getMonth() + 1);

  const [activeTab, setActiveTab] = useState('employee');
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        user_id: initialData.user_id,
        user_name: initialData.user_name || '',
        user_role: initialData.user_role || 'waiter',
        department: initialData.department || '',
        subfranchise_id: initialData.subfranchise_id || null,
        pay_period_start: initialData.pay_period_start || defaultDates.start,
        pay_period_end: initialData.pay_period_end || defaultDates.end,
        pay_period_label: initialData.pay_period_label || defaultDates.label,
        total_working_days: initialData.total_working_days ?? 26,
        days_present: initialData.days_present ?? 26,
        days_absent: initialData.days_absent ?? 0,
        days_leave: initialData.days_leave ?? 0,
        days_holiday: initialData.days_holiday ?? 0,
        regular_hours: initialData.regular_hours ?? 208,
        overtime_hours: initialData.overtime_hours ?? 0,
        basic_salary: initialData.basic_salary ?? 0,
        hourly_rate: initialData.hourly_rate ?? 0,
        overtime_rate: initialData.overtime_rate ?? 1.5,
        overtime_pay: initialData.overtime_pay ?? 0,
        hra: initialData.hra ?? 0,
        transport: initialData.transport ?? 0,
        meals: initialData.meals ?? 0,
        medical: initialData.medical ?? 0,
        other_allowances: initialData.other_allowances ?? 0,
        tax: initialData.tax ?? 0,
        provident_fund: initialData.provident_fund ?? 0,
        insurance: initialData.insurance ?? 0,
        advance_deduction: initialData.advance_deduction ?? 0,
        late_deduction: initialData.late_deduction ?? 0,
        absent_deduction: initialData.absent_deduction ?? 0,
        other_deductions: initialData.other_deductions ?? 0,
        performance_bonus: initialData.performance_bonus ?? 0,
        festival_bonus: initialData.festival_bonus ?? 0,
        tips_shared: initialData.tips_shared ?? 0,
        status: initialData.status || 'draft',
        payment_method: initialData.payment_method || 'bank_transfer',
        payment_reference: initialData.payment_reference || '',
        payment_date: initialData.payment_date || now.toISOString().split('T')[0],
        notes: initialData.notes || '',
      };
    }

    const firstUser = users[0];
    const ucfg = (firstUser && staffConfig[firstUser.id]) || {};
    return {
      user_id: firstUser ? firstUser.id : '',
      user_name: firstUser ? firstUser.name : '',
      user_role: firstUser ? firstUser.role : 'waiter',
      department: ucfg.department || '',
      subfranchise_id: firstUser?.subfranchise_id || null,
      pay_period_start: defaultDates.start,
      pay_period_end: defaultDates.end,
      pay_period_label: defaultDates.label,
      total_working_days: 26,
      days_present: 26,
      days_absent: 0,
      days_leave: 0,
      days_holiday: 0,
      regular_hours: 208,
      overtime_hours: 0,
      basic_salary: ucfg.basic_salary || 0,
      hourly_rate: ucfg.hourly_rate || 0,
      overtime_rate: ucfg.overtime_rate || 1.5,
      overtime_pay: 0,
      hra: ucfg.hra || 0,
      transport: ucfg.transport || 0,
      meals: ucfg.meals || 0,
      medical: ucfg.medical || 0,
      other_allowances: ucfg.other_allowances || 0,
      tax: ucfg.tax_percent ? parseFloat(((+ucfg.basic_salary || 0) * (+ucfg.tax_percent || 0) / 100).toFixed(2)) : 0,
      provident_fund: ucfg.pf_percent ? parseFloat(((+ucfg.basic_salary || 0) * (+ucfg.pf_percent || 0) / 100).toFixed(2)) : 0,
      insurance: ucfg.insurance || 0,
      advance_deduction: 0,
      late_deduction: 0,
      absent_deduction: 0,
      other_deductions: 0,
      performance_bonus: ucfg.performance_bonus || 0,
      festival_bonus: 0,
      tips_shared: 0,
      status: 'draft',
      payment_method: 'bank_transfer',
      payment_reference: '',
      payment_date: now.toISOString().split('T')[0],
      notes: '',
    };
  });

  const upd = (field, val) => setForm((p) => ({ ...p, [field]: val }));

  const handleUserChange = (uid) => {
    const u = users.find((x) => String(x.id) === String(uid));
    if (!u) return;
    const cfg = staffConfig[u.id] || {};
    setForm((prev) => ({
      ...prev,
      user_id: u.id,
      user_name: u.name,
      user_role: u.role,
      subfranchise_id: u.subfranchise_id || null,
      department: cfg.department || prev.department || '',
      basic_salary: cfg.basic_salary ?? prev.basic_salary,
      hourly_rate: cfg.hourly_rate ?? prev.hourly_rate,
      overtime_rate: cfg.overtime_rate ?? 1.5,
      hra: cfg.hra ?? prev.hra,
      transport: cfg.transport ?? prev.transport,
      meals: cfg.meals ?? prev.meals,
      medical: cfg.medical ?? prev.medical,
      other_allowances: cfg.other_allowances ?? prev.other_allowances,
      tax: cfg.tax_percent ? parseFloat(((+cfg.basic_salary || 0) * (+cfg.tax_percent || 0) / 100).toFixed(2)) : prev.tax,
      provident_fund: cfg.pf_percent ? parseFloat(((+cfg.basic_salary || 0) * (+cfg.pf_percent || 0) / 100).toFixed(2)) : prev.provident_fund,
      insurance: cfg.insurance ?? prev.insurance,
      performance_bonus: cfg.performance_bonus ?? prev.performance_bonus,
    }));
  };

  const handlePeriodQuickChange = (yr, mo) => {
    setSelectedYear(yr);
    setSelectedMonth(mo);
    const d = getDates(yr, mo);
    setForm((prev) => ({
      ...prev,
      pay_period_start: d.start,
      pay_period_end: d.end,
      pay_period_label: d.label,
    }));
  };

  const applyStaffDefaults = () => {
    const cfg = staffConfig[form.user_id] || {};
    setForm((prev) => ({
      ...prev,
      department: cfg.department || prev.department,
      basic_salary: cfg.basic_salary ?? prev.basic_salary,
      hourly_rate: cfg.hourly_rate ?? prev.hourly_rate,
      overtime_rate: cfg.overtime_rate ?? 1.5,
      hra: cfg.hra ?? prev.hra,
      transport: cfg.transport ?? prev.transport,
      meals: cfg.meals ?? prev.meals,
      medical: cfg.medical ?? prev.medical,
      other_allowances: cfg.other_allowances ?? prev.other_allowances,
      tax: cfg.tax_percent ? parseFloat(((+cfg.basic_salary || 0) * (+cfg.tax_percent || 0) / 100).toFixed(2)) : prev.tax,
      provident_fund: cfg.pf_percent ? parseFloat(((+cfg.basic_salary || 0) * (+cfg.pf_percent || 0) / 100).toFixed(2)) : prev.provident_fund,
      insurance: cfg.insurance ?? prev.insurance,
      performance_bonus: cfg.performance_bonus ?? prev.performance_bonus,
    }));
  };

  const autoCalcOvertime = () => {
    const otHrs = parseFloat(form.overtime_hours || 0);
    const rate = parseFloat(form.hourly_rate || 0);
    const mult = parseFloat(form.overtime_rate || 1.5);
    const calc = parseFloat((otHrs * rate * mult).toFixed(2));
    upd('overtime_pay', calc);
  };

  const autoCalcAbsent = () => {
    const basic = parseFloat(form.basic_salary || 0);
    const totalDays = parseFloat(form.total_working_days || 26);
    const absent = parseFloat(form.days_absent || 0);
    if (totalDays > 0 && absent > 0) {
      const calc = parseFloat(((basic / totalDays) * absent).toFixed(2));
      upd('absent_deduction', calc);
    }
  };

  // Real-time calculations
  const totalAllowances = (
    parseFloat(form.hra || 0) +
    parseFloat(form.transport || 0) +
    parseFloat(form.meals || 0) +
    parseFloat(form.medical || 0) +
    parseFloat(form.other_allowances || 0)
  );

  const totalDeductions = (
    parseFloat(form.tax || 0) +
    parseFloat(form.provident_fund || 0) +
    parseFloat(form.insurance || 0) +
    parseFloat(form.advance_deduction || 0) +
    parseFloat(form.late_deduction || 0) +
    parseFloat(form.absent_deduction || 0) +
    parseFloat(form.other_deductions || 0)
  );

  const grossSalary = (
    parseFloat(form.basic_salary || 0) +
    parseFloat(form.overtime_pay || 0) +
    totalAllowances +
    parseFloat(form.performance_bonus || 0) +
    parseFloat(form.festival_bonus || 0) +
    parseFloat(form.tips_shared || 0)
  );

  const netSalary = parseFloat((grossSalary - totalDeductions).toFixed(2));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.user_id) {
      alert('Please select an employee');
      return;
    }
    setBusy(true);
    await onSave(form, isEdit);
    setBusy(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{
        width: '100%', maxWidth: 840, maxHeight: '92vh',
        background: isDark ? '#0B1838' : '#FFFFFF',
        borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: isDark ? '0 25px 60px -15px rgba(0,0,0,0.7)' : '0 20px 45px rgba(0,0,0,0.12)',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E2E8F0',
        color: isDark ? '#FFFFFF' : '#0F172A',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(212,160,23,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,160,23,0.3)' }}>
              {isEdit ? <Edit size={20} style={{ color: GOLD }} /> : <PlusCircle size={20} style={{ color: GOLD }} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                {isEdit ? 'Edit Payroll Record' : 'Manual Payroll Entry'}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(212,160,23,0.2)', color: GOLD, fontWeight: 700 }}>Admin Direct</span>
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>
                {isEdit ? `Updating salary details for ${form.user_name}` : 'Create a custom salary record with custom attendance, allowances, and bonuses'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #CBD5E1', background: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', color: isDark ? '#94A3B8' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          background: isDark ? 'rgba(0,0,0,0.25)' : '#F1F5F9',
          padding: '6px 20px', gap: 8, overflowX: 'auto',
        }}>
          {[
            { id: 'employee',   label: '1. Staff & Period',   icon: User, badge: form.user_name || 'Select' },
            { id: 'earnings',   label: '2. Earnings & OT',    icon: DollarSign, badge: fmtShort(grossSalary) },
            { id: 'deductions', label: '3. Deductions',       icon: TrendingDown, badge: `-${fmtShort(totalDeductions)}` },
            { id: 'payout',     label: '4. Status & Payout',  icon: Banknote, badge: form.status },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10,
                  border: active ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                  background: active ? (isDark ? 'rgba(212,160,23,0.15)' : '#FEF3C7') : 'transparent',
                  color: active ? (isDark ? GOLD : '#B45309') : (isDark ? '#94A3B8' : '#64748B'),
                  cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 8,
                  background: active ? (isDark ? 'rgba(212,160,23,0.25)' : '#FDE68A') : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                  color: active ? (isDark ? '#fff' : '#92400E') : (isDark ? '#94A3B8' : '#64748B'),
                  fontWeight: 600,
                }}>
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>

          {/* TAB 1: EMPLOYEE & PERIOD */}
          {activeTab === 'employee' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select Staff Member *</label>
                  <select
                    disabled={isEdit}
                    value={form.user_id}
                    onChange={(e) => handleUserChange(e.target.value)}
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 12px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                      border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                      borderRadius: 10,
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      fontSize: 13, outline: 'none'
                    }}
                  >
                    <option value="" disabled style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>-- Select Employee --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <InputField label="Department" value={form.department} onChange={(v) => upd('department', v)} isDark={isDark} />
              </div>

              {/* Pay Period Quick Chooser */}
              <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} /> Pay Period Selection
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase' }}>Month</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => handlePeriodQuickChange(selectedYear, e.target.value)}
                      style={{
                        width: '100%', marginTop: 4, padding: '8px 12px',
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                        borderRadius: 10,
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontSize: 13, outline: 'none'
                      }}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase' }}>Year</label>
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => handlePeriodQuickChange(e.target.value, selectedMonth)}
                      style={{
                        width: '100%', marginTop: 4, boxSizing: 'border-box', padding: '8px 12px',
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                        borderRadius: 10,
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontSize: 13, outline: 'none'
                      }}
                    />
                  </div>
                  <InputField label="Period Label (Payslip Display)" value={form.pay_period_label} onChange={(v) => upd('pay_period_label', v)} isDark={isDark} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField label="Period Start Date" type="date" value={form.pay_period_start} onChange={(v) => upd('pay_period_start', v)} isDark={isDark} />
                  <InputField label="Period End Date" type="date" value={form.pay_period_end} onChange={(v) => upd('pay_period_end', v)} isDark={isDark} />
                </div>
              </div>

              {/* Attendance & Work Stats */}
              <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> Attendance & Work Metrics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
                  <InputField label="Working Days"  type="number" value={form.total_working_days} onChange={(v) => upd('total_working_days', v)} isDark={isDark} />
                  <InputField label="Present Days"  type="number" value={form.days_present}       onChange={(v) => upd('days_present', v)} isDark={isDark} />
                  <InputField label="Absent Days"   type="number" value={form.days_absent}        onChange={(v) => upd('days_absent', v)} isDark={isDark} />
                  <InputField label="Leave Days"    type="number" value={form.days_leave}         onChange={(v) => upd('days_leave', v)} isDark={isDark} />
                  <InputField label="Holidays"      type="number" value={form.days_holiday}       onChange={(v) => upd('days_holiday', v)} isDark={isDark} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <InputField label="Regular Hours Worked" type="number" value={form.regular_hours} onChange={(v) => upd('regular_hours', v)} prefix="hrs" isDark={isDark} />
                  <InputField label="Overtime Hours" type="number" value={form.overtime_hours} onChange={(v) => upd('overtime_hours', v)} prefix="hrs" isDark={isDark} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EARNINGS & OVERTIME */}
          {activeTab === 'earnings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <InputField label="Basic Salary *" type="number" prefix="Nu." value={form.basic_salary} onChange={(v) => upd('basic_salary', v)} isDark={isDark} />
                <InputField label="Hourly Rate"   type="number" prefix="Nu." value={form.hourly_rate}   onChange={(v) => upd('hourly_rate', v)} isDark={isDark} />
                <InputField label="OT Multiplier" type="number" prefix="x"   value={form.overtime_rate} onChange={(v) => upd('overtime_rate', v)} isDark={isDark} />
              </div>

              {/* Overtime pay with quick calc */}
              <div style={{
                background: isDark ? 'rgba(59,130,246,0.06)' : '#EFF6FF',
                border: isDark ? '1px solid rgba(59,130,246,0.2)' : '1px solid #BFDBFE',
                borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <InputField label="Overtime Pay (Nu.)" type="number" prefix="Nu." value={form.overtime_pay} onChange={(v) => upd('overtime_pay', v)} isDark={isDark} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#475569' }}>Formula: OT Hours ({form.overtime_hours || 0}h) × Rate ({fmt(form.hourly_rate)}) × Multiplier ({form.overtime_rate}x)</div>
                  <button
                    type="button"
                    onClick={autoCalcOvertime}
                    style={{
                      padding: '7px 14px', borderRadius: 8,
                      border: isDark ? '1px solid rgba(59,130,246,0.4)' : '1px solid #93C5FD',
                      background: isDark ? 'rgba(59,130,246,0.15)' : '#DBEAFE',
                      color: isDark ? '#60A5FA' : '#1D4ED8',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Zap size={13} /> Compute OT Pay
                  </button>
                </div>
              </div>

              {/* Allowances */}
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                borderRadius: 14, padding: 16
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', marginBottom: 12 }}>
                  Monthly Allowances (Total: {fmt(totalAllowances)})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <InputField label="HRA (Housing)"   type="number" prefix="Nu." value={form.hra}              onChange={(v) => upd('hra', v)} isDark={isDark} />
                  <InputField label="Transport"       type="number" prefix="Nu." value={form.transport}        onChange={(v) => upd('transport', v)} isDark={isDark} />
                  <InputField label="Meals"           type="number" prefix="Nu." value={form.meals}            onChange={(v) => upd('meals', v)} isDark={isDark} />
                  <InputField label="Medical"         type="number" prefix="Nu." value={form.medical}          onChange={(v) => upd('medical', v)} isDark={isDark} />
                  <InputField label="Other Allowances"type="number" prefix="Nu." value={form.other_allowances} onChange={(v) => upd('other_allowances', v)} isDark={isDark} />
                </div>
              </div>

              {/* Bonuses & Incentives */}
              <div style={{
                background: isDark ? 'rgba(16,185,129,0.05)' : '#F0FDF4',
                border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #BBF7D0',
                borderRadius: 14, padding: 16
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: 12 }}>
                  Incentives & Bonuses
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <InputField label="Performance Bonus" type="number" prefix="Nu." value={form.performance_bonus} onChange={(v) => upd('performance_bonus', v)} isDark={isDark} />
                  <InputField label="Festival Bonus"    type="number" prefix="Nu." value={form.festival_bonus}    onChange={(v) => upd('festival_bonus', v)} isDark={isDark} />
                  <InputField label="Tips Shared"       type="number" prefix="Nu." value={form.tips_shared}       onChange={(v) => upd('tips_shared', v)} isDark={isDark} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEDUCTIONS */}
          {activeTab === 'deductions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: isDark ? 'rgba(239,68,68,0.06)' : '#FEF2F2',
                border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid #FECACA',
                borderRadius: 14, padding: 16
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', marginBottom: 12 }}>
                  Statutory Deductions (Total: {fmt(totalDeductions)})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <InputField label="Tax (Income Tax)"  type="number" prefix="Nu." value={form.tax}            onChange={(v) => upd('tax', v)} isDark={isDark} />
                  <InputField label="Provident Fund"   type="number" prefix="Nu." value={form.provident_fund} onChange={(v) => upd('provident_fund', v)} isDark={isDark} />
                  <InputField label="Insurance"        type="number" prefix="Nu." value={form.insurance}      onChange={(v) => upd('insurance', v)} isDark={isDark} />
                </div>
              </div>

              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                borderRadius: 14, padding: 16
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', marginBottom: 12 }}>
                  Adjustments & Penalties
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <InputField label="Advance / Loan Repayment" type="number" prefix="Nu." value={form.advance_deduction} onChange={(v) => upd('advance_deduction', v)} isDark={isDark} />
                  <InputField label="Late Arrival Penalty"     type="number" prefix="Nu." value={form.late_deduction}    onChange={(v) => upd('late_deduction', v)} isDark={isDark} />
                </div>

                {/* Absent deduction with quick calc */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                  padding: 12, borderRadius: 10,
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E2E8F0'
                }}>
                  <div style={{ flex: 1 }}>
                    <InputField label="Absent Deduction (Nu.)" type="number" prefix="Nu." value={form.absent_deduction} onChange={(v) => upd('absent_deduction', v)} isDark={isDark} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }}>Based on {form.days_absent || 0} absent days</div>
                    <button
                      type="button"
                      onClick={autoCalcAbsent}
                      style={{
                        padding: '7px 14px', borderRadius: 8,
                        border: isDark ? '1px solid rgba(245,158,11,0.4)' : '1px solid #FCD34D',
                        background: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
                        color: isDark ? '#FBBF24' : '#B45309',
                        cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Zap size={13} /> Compute Absent Cut
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <InputField label="Other Deductions" type="number" prefix="Nu." value={form.other_deductions} onChange={(v) => upd('other_deductions', v)} isDark={isDark} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STATUS & PAYOUT */}
          {activeTab === 'payout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payroll Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => upd('status', e.target.value)}
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 12px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                      border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                      borderRadius: 10,
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      fontSize: 13, outline: 'none'
                    }}
                  >
                    {['draft','pending','approved','paid','on_hold'].map((st) => (
                      <option key={st} value={st} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {STATUS_STYLES[st]?.label || st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => upd('payment_method', e.target.value)}
                    style={{
                      width: '100%', marginTop: 5, padding: '9px 12px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                      border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                      borderRadius: 10,
                      color: isDark ? '#FFFFFF' : '#0F172A',
                      fontSize: 13, outline: 'none'
                    }}
                  >
                    {['bank_transfer','cash','cheque','upi','other'].map((m) => (
                      <option key={m} value={m} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.status === 'paid' && (
                <div style={{
                  background: isDark ? 'rgba(59,130,246,0.08)' : '#EFF6FF',
                  border: isDark ? '1px solid rgba(59,130,246,0.25)' : '1px solid #BFDBFE',
                  borderRadius: 14, padding: 16
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Banknote size={15} /> Payment Settlement Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <InputField label="Payment Reference / Txn ID" value={form.payment_reference} onChange={(v) => upd('payment_reference', v)} isDark={isDark} />
                    <InputField label="Payment Date" type="date" value={form.payment_date} onChange={(v) => upd('payment_date', v)} isDark={isDark} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94A3B8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Internal Notes & Remarks</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => upd('notes', e.target.value)}
                  placeholder="e.g. Special festival bonus added as agreed in staff meeting..."
                  style={{
                    width: '100%', marginTop: 5, boxSizing: 'border-box', padding: '10px 14px',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                    border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #CBD5E1',
                    borderRadius: 10,
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    fontSize: 13, outline: 'none', resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Calculation Metric Bar */}
        <div style={{
          background: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9',
          borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          padding: '14px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0
        }}>
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
            padding: '8px 12px', borderRadius: 10,
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #CBD5E1'
          }}>
            <div style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase' }}>Basic + Overtime</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>{fmt(parseFloat(form.basic_salary || 0) + parseFloat(form.overtime_pay || 0))}</div>
          </div>
          <div style={{
            background: isDark ? 'rgba(16,185,129,0.06)' : '#ECFDF5',
            padding: '8px 12px', borderRadius: 10,
            border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #A7F3D0'
          }}>
            <div style={{ fontSize: 10, color: '#059669', textTransform: 'uppercase' }}>Gross Salary</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981', marginTop: 2 }}>{fmt(grossSalary)}</div>
          </div>
          <div style={{
            background: isDark ? 'rgba(239,68,68,0.06)' : '#FEF2F2',
            padding: '8px 12px', borderRadius: 10,
            border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid #FECACA'
          }}>
            <div style={{ fontSize: 10, color: '#DC2626', textTransform: 'uppercase' }}>Total Deductions</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>-{fmt(totalDeductions)}</div>
          </div>
          <div style={{
            background: isDark ? 'linear-gradient(135deg,rgba(212,160,23,0.15),rgba(212,160,23,0.05))' : '#FFFBEB',
            padding: '8px 12px', borderRadius: 10,
            border: isDark ? '1px solid rgba(212,160,23,0.3)' : '1px solid #FDE68A'
          }}>
            <div style={{ fontSize: 10, color: isDark ? GOLD : '#B45309', textTransform: 'uppercase', fontWeight: 800 }}>Net Pay Payable</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: isDark ? GOLD : '#B45309', marginTop: 2 }}>{fmt(netSalary)}</div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
          background: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'
        }}>
          <button
            type="button"
            onClick={applyStaffDefaults}
            style={{
              padding: '9px 16px', borderRadius: 10,
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
              background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
              color: isDark ? '#94A3B8' : '#475569',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <RefreshCw size={13} /> Reset Staff Defaults
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                color: isDark ? '#94A3B8' : '#475569',
                cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit}
              style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${GOLD},#A16207)`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(212,160,23,0.3)', opacity: busy ? 0.7 : 1 }}
            >
              <Save size={14} /> {busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Payroll')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────────────────── */
const PayrollSystem = ({ currentUser }) => {
  const themeCtx = useTheme();
  const isDark = (themeCtx?.resolvedTheme || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light')) === 'dark';

  const API = getAPI_URL();
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const isAdmin = ['admin', 'manager'].includes(currentUser?.role);
  const now = new Date();

  /* ── state ── */
  const [tab, setTab] = useState(isAdmin ? 'overview' : 'myslips');
  const [records,     setRecords]     = useState([]);
  const [mySlips,     setMySlips]     = useState([]);
  const [users,       setUsers]       = useState([]);
  const [staffConfig, setStaffConfig] = useState({});
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);

  const [filterYear,   setFilterYear]   = useState(String(now.getFullYear()));
  const [filterMonth,  setFilterMonth]  = useState(String(now.getMonth() + 1));
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');

  const [payslipRecord, setPayslipRecord] = useState(null);
  const [payRecord,     setPayRecord]     = useState(null);
  const [showConfig,    setShowConfig]    = useState(false);
  const [showGenerate,  setShowGenerate]  = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [editingPayroll,   setEditingPayroll]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `year=${filterYear}&month=${filterMonth}${filterStatus ? `&status=${filterStatus}` : ''}`;
      const calls = [
        isAdmin ? fetch(`${API}/api/payroll?${qs}`, { headers }) : null,
        isAdmin ? fetch(`${API}/api/payroll/summary?${qs}`, { headers }) : null,
        isAdmin ? fetch(`${API}/api/users`, { headers }) : null,
        isAdmin ? fetch(`${API}/api/payroll/staff-config`, { headers }) : null,
        fetch(`${API}/api/payroll/my`, { headers }),
      ];
      const [recRes, summRes, usersRes, cfgRes, myRes] = await Promise.all(calls);

      if (recRes?.ok)   setRecords(await recRes.json());
      if (summRes?.ok)  setSummary(await summRes.json());
      if (usersRes?.ok) { const d = await usersRes.json(); setUsers(Array.isArray(d) ? d : (d.users || [])); }
      if (cfgRes?.ok)   {
        const d = await cfgRes.json();
        let c = d.config;
        if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
        setStaffConfig(c || {});
      }
      if (myRes?.ok) setMySlips(await myRes.json());
    } catch {
      showToast('Failed to load payroll data', 'error');
    }
    setLoading(false);
  }, [API, filterYear, filterMonth, filterStatus, isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── actions ── */
  const handleSaveManualPayroll = async (formData, isEdit) => {
    try {
      const url = isEdit ? `${API}/api/payroll/${editingPayroll.id}` : `${API}/api/payroll`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to save payroll record', 'error');
        return false;
      }
      showToast(isEdit ? 'Payroll record updated ✅' : 'Manual payroll record created 🎉');
      setShowManualCreate(false);
      setEditingPayroll(null);
      fetchAll();
      return true;
    } catch {
      showToast('Network error saving payroll', 'error');
      return false;
    }
  };

  const approve = async (id) => {
    await fetch(`${API}/api/payroll/${id}/approve`, { method: 'PUT', headers });
    showToast('Payroll approved ✅');
    fetchAll();
  };

  const markPaid = async (id, data) => {
    await fetch(`${API}/api/payroll/${id}/pay`, { method: 'PUT', headers, body: JSON.stringify(data) });
    setPayRecord(null);
    showToast('Marked as paid 💸');
    fetchAll();
  };

  const deleteRec = async (id) => {
    if (!window.confirm('Delete this draft payroll record?')) return;
    await fetch(`${API}/api/payroll/${id}`, { method: 'DELETE', headers });
    showToast('Deleted');
    fetchAll();
  };

  const saveConfig = async (c) => {
    await fetch(`${API}/api/payroll/staff-config`, { method: 'PUT', headers, body: JSON.stringify({ config: c }) });
    setStaffConfig(c);
    setShowConfig(false);
    showToast('Salary configuration saved ✅');
  };

  const generatePayroll = async (yr, mo) => {
    const res = await fetch(`${API}/api/payroll/generate`, {
      method: 'POST', headers,
      body: JSON.stringify({ year: parseInt(yr), month: parseInt(mo), staff_config: staffConfig }),
    });
    const d = await res.json();
    setShowGenerate(false);
    if (res.ok) { showToast(`Generated ${d.created?.length || 0} payroll records 🎉`); fetchAll(); }
    else showToast(d.message || 'Generation failed', 'error');
  };

  /* ── derived ── */
  const filtered = records.filter((r) =>
    !search || r.user_name?.toLowerCase().includes(search.toLowerCase()) || r.user_role?.toLowerCase().includes(search.toLowerCase())
  );

  const chartData = (() => {
    const m = {};
    records.forEach((r) => {
      if (!m[r.user_name]) m[r.user_name] = { name: r.user_name.split(' ')[0], gross: 0, net: 0, ded: 0 };
      m[r.user_name].gross += parseFloat(r.gross_salary || 0);
      m[r.user_name].net   += parseFloat(r.net_salary   || 0);
      m[r.user_name].ded   += parseFloat(r.total_deductions || 0);
    });
    return Object.values(m).slice(0, 8);
  })();

  const statusChart = summary
    ? Object.entries(summary.byStatus || {}).map(([k, v]) => ({ name: STATUS_STYLES[k]?.label || k, value: v, color: STATUS_STYLES[k]?.color || '#94A3B8' }))
    : [];

  const selWrap = (h) => ({
    padding: '8px 14px',
    background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
    borderRadius: 10,
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 13,
    outline: 'none',
    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
    ...(h ? { width: h } : {}),
  });

  /* ── render ── */
  return (
    <div style={{
      padding: '24px 32px',
      maxWidth: 1400,
      margin: '0 auto',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: isDark ? '#FFFFFF' : '#0F172A',
      minHeight: '100vh',
    }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2000, padding: '12px 20px', borderRadius: 14, background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)', backdropFilter: 'blur(12px)', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', animation: 'slideIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>

      {/* Modals */}
      {payslipRecord && <PayslipModal record={payslipRecord} onClose={() => setPayslipRecord(null)} isDark={isDark} />}
      {payRecord     && <PayModal record={payRecord} onPay={(d) => markPaid(payRecord.id, d)} onClose={() => setPayRecord(null)} isDark={isDark} />}
      {showConfig    && <StaffConfigDrawer users={users.filter((u) => !['franchise','subfranchise'].includes(u.role))} config={staffConfig} onSave={saveConfig} onClose={() => setShowConfig(false)} isDark={isDark} />}
      {showGenerate  && <GenerateModal onGenerate={generatePayroll} onClose={() => setShowGenerate(false)} isDark={isDark} />}
      {showManualCreate && (
        <ManualPayrollModal
          users={users.filter((u) => !['franchise','subfranchise'].includes(u.role))}
          staffConfig={staffConfig}
          initialData={editingPayroll}
          onSave={handleSaveManualPayroll}
          onClose={() => { setShowManualCreate(false); setEditingPayroll(null); }}
          isDark={isDark}
        />
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: '-0.03em' }}>
            <span style={{ background: `linear-gradient(135deg,${GOLD},#F59E0B)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Payroll</span> Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#94A3B8' : '#64748B' }}>Staff salary processing, payslips & financial analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ThemeToggle />
          {isAdmin && (
            <>
              <button
                onClick={() => { setEditingPayroll(null); setShowManualCreate(true); }}
                style={{
                  padding: '10px 20px', borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg,${GOLD},#A16207)`,
                  color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: '0 4px 16px rgba(212,160,23,0.35)',
                }}
              >
                <PlusCircle size={15} /> Create Payroll
              </button>
              <button
                onClick={() => setShowGenerate(true)}
                style={{
                  padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(212,160,23,0.3)',
                  background: isDark ? 'rgba(212,160,23,0.1)' : '#FEF3C7',
                  color: isDark ? GOLD : '#B45309',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Zap size={14} /> Auto-Generate
              </button>
              <button
                onClick={() => setShowConfig(true)}
                style={{
                  padding: '10px 18px', borderRadius: 12,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <Settings size={14} /> Salary Config
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
        padding: 4, borderRadius: 14, width: 'fit-content',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
      }}>
        {(isAdmin ? ['overview', 'records'] : []).concat(['myslips']).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: 10, border: 'none',
              background: tab === t ? `linear-gradient(135deg,${GOLD},#A16207)` : 'transparent',
              color: tab === t ? '#fff' : (isDark ? '#94A3B8' : '#64748B'),
              fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {t === 'overview' ? '📊 Overview' : t === 'records' ? '📋 Records' : '💼 My Payslips'}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW ═══════════ */}
      {tab === 'overview' && isAdmin && (
        <>
          {/* Period filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={selWrap()}>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i+1)} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{m}</option>
              ))}
            </select>
            <input type="number" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ ...selWrap(), width: 90 }} />
            <button
              onClick={fetchAll}
              style={{
                padding: '8px 14px', borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                color: isDark ? '#94A3B8' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard icon={DollarSign}   label="Total Gross"          value={fmtShort(summary?.totalGross      || 0)} sub={`${summary?.total || 0} employees`} accent={GOLD}    isDark={isDark} />
            <StatCard icon={Wallet}       label="Total Net Payout"     value={fmtShort(summary?.totalNet        || 0)} sub="After all deductions"               accent="#3B82F6" isDark={isDark} />
            <StatCard icon={TrendingDown} label="Total Deductions"     value={fmtShort(summary?.totalDeductions || 0)} sub="Tax, PF, penalties"                 accent="#EF4444" isDark={isDark} />
            <StatCard icon={Award}        label="Bonuses & Incentives" value={fmtShort(summary?.totalBonus    || 0)} sub="Performance + Festival"             accent="#10B981" isDark={isDark} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ ...getGlass(isDark), padding: 22 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A' }}>Salary Breakdown by Employee</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                    <Tooltip
                      contentStyle={{
                        background: isDark ? 'rgba(11,24,56,0.95)' : '#FFFFFF',
                        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                        borderRadius: 12,
                        fontSize: 12,
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.1)',
                      }}
                      formatter={(v, n) => [fmt(v), n.charAt(0).toUpperCase() + n.slice(1)]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: isDark ? '#94A3B8' : '#475569' }} />
                    <Bar dataKey="gross" fill={NAVY}     name="Gross"      radius={[4,4,0,0]} />
                    <Bar dataKey="net"   fill={GOLD}     name="Net"        radius={[4,4,0,0]} />
                    <Bar dataKey="ded"   fill="#EF4444"  name="Deductions" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ ...getGlass(isDark), padding: 22 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A' }}>Status Distribution</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <RPieChart>
                    <Pie data={statusChart.length ? statusChart : [{ name: 'No data', value: 1, color: isDark ? '#334155' : '#E2E8F0' }]} dataKey="value" innerRadius={55} outerRadius={85} stroke="none">
                      {(statusChart.length ? statusChart : [{ color: isDark ? '#334155' : '#E2E8F0' }]).map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    {statusChart.length > 0 && (
                      <Tooltip
                        contentStyle={{
                          background: isDark ? 'rgba(11,24,56,0.95)' : '#FFFFFF',
                          border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                          borderRadius: 12,
                          fontSize: 12,
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        }}
                      />
                    )}
                  </RPieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {statusChart.map((s) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent table */}
          <div style={{ ...getGlass(isDark), overflow: 'hidden' }}>
            <div style={{
              padding: '18px 22px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
              background: isDark ? 'transparent' : '#F8FAFC'
            }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A' }}>Recent Payroll Records</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                    background: isDark ? 'transparent' : '#F8FAFC',
                  }}>
                    {['Employee','Role','Period','Gross','Deductions','Net','Status',''].map((h) => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 8).map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #F1F5F9' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 14px', color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: 600 }}>{r.user_name}</td>
                      <td style={{ padding: '12px 14px' }}><span style={{ color: ROLE_COLORS[r.user_role] || '#94A3B8', fontWeight: 600, textTransform: 'capitalize', fontSize: 12 }}>{r.user_role}</span></td>
                      <td style={{ padding: '12px 14px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>{r.pay_period_label || r.pay_period_start}</td>
                      <td style={{ padding: '12px 14px', color: '#10B981', fontWeight: 700 }}>{fmt(r.gross_salary)}</td>
                      <td style={{ padding: '12px 14px', color: '#EF4444', fontWeight: 600 }}>-{fmt(r.total_deductions)}</td>
                      <td style={{ padding: '12px 14px', color: GOLD, fontWeight: 800 }}>{fmt(r.net_salary)}</td>
                      <td style={{ padding: '12px 14px' }}><StatusBadge status={r.status} isDark={isDark} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ActionBtn title="View payslip" onClick={() => setPayslipRecord(r)} color={isDark ? '#94A3B8' : '#475569'} icon={Eye} isDark={isDark} />
                          {['draft','pending','on_hold'].includes(r.status) && (
                            <ActionBtn title="Edit record" onClick={() => { setEditingPayroll(r); setShowManualCreate(true); }} color="#D4A017" icon={Edit} isDark={isDark} />
                          )}
                          {r.status === 'draft'    && <ActionBtn title="Approve"  onClick={() => approve(r.id)}    color="#10B981" icon={CheckCircle} isDark={isDark} />}
                          {r.status === 'approved' && <ActionBtn title="Mark paid" onClick={() => setPayRecord(r)} color="#3B82F6" icon={Banknote}    isDark={isDark} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && !loading && (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>
                      No records for this period. Click <strong>Create Payroll</strong> or <strong>Generate Payroll</strong> to add records.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ RECORDS ═══════════ */}
      {tab === 'records' && isAdmin && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => { setEditingPayroll(null); setShowManualCreate(true); }}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg,${GOLD},#A16207)`,
                color: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 10px rgba(212,160,23,0.25)',
              }}
            >
              <PlusCircle size={14} /> New Payroll Entry
            </button>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: isDark ? '#94A3B8' : '#64748B', pointerEvents: 'none' }} />
              <input
                placeholder="Search employee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                  borderRadius: 10,
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  fontSize: 13, outline: 'none', width: 200,
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                }}
              />
            </div>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={selWrap()}>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i+1)} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{m}</option>
              ))}
            </select>
            <input type="number" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ ...selWrap(), width: 90 }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selWrap()}>
              <option value="" style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>All Status</option>
              {Object.keys(STATUS_STYLES).map((s) => (
                <option key={s} value={s} style={{ background: isDark ? '#1E3A8A' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#0F172A' }}>{STATUS_STYLES[s].label}</option>
              ))}
            </select>
            <button
              onClick={fetchAll}
              style={{
                padding: '8px 14px', borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #CBD5E1',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                color: isDark ? '#94A3B8' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>{filtered.length} records</span>
          </div>

          <div style={{ ...getGlass(isDark), overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
                    background: isDark ? 'transparent' : '#F8FAFC',
                  }}>
                    {['Employee','Role','Period','Days','Hrs','Basic','Gross','Net','Status','Actions'].map((h) => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #F1F5F9' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A' }}>{r.user_name}</div>
                        {r.department && <div style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }}>{r.department}</div>}
                      </td>
                      <td style={{ padding: '11px 14px' }}><span style={{ color: ROLE_COLORS[r.user_role] || '#94A3B8', fontWeight: 600, textTransform: 'capitalize', fontSize: 11 }}>{r.user_role}</span></td>
                      <td style={{ padding: '11px 14px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>{r.pay_period_label || r.pay_period_start}</td>
                      <td style={{ padding: '11px 14px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>{r.days_present}/{r.total_working_days}</td>
                      <td style={{ padding: '11px 14px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 12 }}>{Number(r.regular_hours || 0).toFixed(1)}h</td>
                      <td style={{ padding: '11px 14px', color: isDark ? '#FFFFFF' : '#0F172A' }}>{fmt(r.basic_salary)}</td>
                      <td style={{ padding: '11px 14px', color: '#10B981', fontWeight: 700 }}>{fmt(r.gross_salary)}</td>
                      <td style={{ padding: '11px 14px', color: GOLD, fontWeight: 800 }}>{fmt(r.net_salary)}</td>
                      <td style={{ padding: '11px 14px' }}><StatusBadge status={r.status} isDark={isDark} /></td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <ActionBtn title="View Payslip" onClick={() => setPayslipRecord(r)} color={isDark ? '#94A3B8' : '#475569'} icon={Eye} isDark={isDark} />
                          {['draft','pending','on_hold'].includes(r.status) && (
                            <ActionBtn title="Edit record" onClick={() => { setEditingPayroll(r); setShowManualCreate(true); }} color="#D4A017" icon={Edit} isDark={isDark} />
                          )}
                          {r.status === 'draft'    && <ActionBtn title="Approve"    onClick={() => approve(r.id)}    color="#10B981" icon={CheckCircle} isDark={isDark} />}
                          {r.status === 'approved' && <ActionBtn title="Mark Paid"  onClick={() => setPayRecord(r)}  color="#3B82F6" icon={Banknote}    isDark={isDark} />}
                          {['draft','on_hold'].includes(r.status) && currentUser?.role === 'admin' && (
                            <ActionBtn title="Delete" onClick={() => deleteRec(r.id)} color="#EF4444" icon={Trash2} isDark={isDark} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>No records found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ MY PAYSLIPS ═══════════ */}
      {tab === 'myslips' && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#FFFFFF' : '#0F172A' }}>My Payslips</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: isDark ? '#94A3B8' : '#64748B' }}>Your salary history — click any card to view & print</p>
          </div>
          {mySlips.length === 0 ? (
            <div style={{ ...getGlass(isDark), padding: 60, textAlign: 'center' }}>
              <FileText size={48} style={{ color: isDark ? '#94A3B8' : '#64748B', margin: '0 auto 16px', display: 'block' }} />
              <p style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 14, margin: 0 }}>No payslips yet. Ask your manager to process payroll.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {mySlips.map((r) => (
                <div
                  key={r.id}
                  style={{ ...getGlass(isDark), padding: 20, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = isDark ? '0 12px 40px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  onClick={() => setPayslipRecord(r)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {r.pay_period_label || r.pay_period_start}
                      </div>
                      <div style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                        {r.days_present}/{r.total_working_days} days present
                      </div>
                    </div>
                    <StatusBadge status={r.status} isDark={isDark} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      background: isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5',
                      border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #A7F3D0',
                      borderRadius: 10, padding: '10px 14px'
                    }}>
                      <div style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#047857', marginBottom: 3, fontWeight: 700 }}>GROSS</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>{fmtShort(r.gross_salary)}</div>
                    </div>
                    <div style={{
                      background: isDark ? 'rgba(212,160,23,0.08)' : '#FFFBEB',
                      border: isDark ? '1px solid rgba(212,160,23,0.3)' : '1px solid #FDE68A',
                      borderRadius: 10, padding: '10px 14px'
                    }}>
                      <div style={{ fontSize: 10, color: isDark ? '#94A3B8' : '#B45309', marginBottom: 3, fontWeight: 700 }}>NET PAY</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? GOLD : '#B45309' }}>{fmtShort(r.net_salary)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                    <span>Deductions: <span style={{ color: '#EF4444', fontWeight: 600 }}>{fmt(r.total_deductions)}</span></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: isDark ? '#38BDF8' : '#0284C7' }}>
                      <Eye size={12} /> View payslip
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: isDark ? '#94A3B8' : '#64748B' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
          Loading payroll data…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
};

export default PayrollSystem;
