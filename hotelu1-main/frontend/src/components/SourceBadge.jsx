import React from 'react';
import { Truck, Store, Smartphone } from 'lucide-react';

/**
 * Visual marker showing where an order came from — Zomato, Swiggy,
 * UberEats, an external mobile app, or in-house. Renders nothing for
 * in-house orders (the default) so dine-in / takeaway cards stay
 * clean.
 */

const META = {
  zomato: {
    label: 'Zomato',
    cls: 'bg-rose-100 text-rose-700 border-rose-200',
    darkCls: 'dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
    Icon: Truck,
  },
  swiggy: {
    label: 'Swiggy',
    cls: 'bg-orange-100 text-orange-700 border-orange-200',
    darkCls:
      'dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-500/30',
    Icon: Truck,
  },
  ubereats: {
    label: 'Uber Eats',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    darkCls:
      'dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-500/30',
    Icon: Truck,
  },
  external: {
    label: 'External app',
    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    darkCls:
      'dark:bg-indigo-500/15 dark:text-indigo-200 dark:border-indigo-500/30',
    Icon: Smartphone,
  },
};

const SourceBadge = ({ source, size = 'sm', className = '' }) => {
  if (!source) return null;
  const key = String(source).toLowerCase();
  if (key === 'in-house' || key === 'inhouse' || key === 'dine-in') return null;
  const meta = META[key];
  if (!meta) return null;
  const Icon = meta.Icon;
  const sizes =
    size === 'xs'
      ? 'text-[9px] px-1.5 py-0.5 gap-1'
      : 'text-[10px] px-2 py-0.5 gap-1';
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${meta.cls} ${meta.darkCls} ${sizes} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
};

export default SourceBadge;
