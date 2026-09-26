const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Payroll = sequelize.define('Payroll', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  // Employee info (denormalised for historical accuracy)
  user_id:    { type: DataTypes.INTEGER, allowNull: false },
  user_name:  { type: DataTypes.STRING,  allowNull: false },
  user_role:  { type: DataTypes.STRING,  allowNull: false },
  department: { type: DataTypes.STRING,  allowNull: true },
  subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },

  // Pay period
  pay_period_start: { type: DataTypes.DATEONLY, allowNull: false },
  pay_period_end:   { type: DataTypes.DATEONLY, allowNull: false },
  pay_period_label: { type: DataTypes.STRING,   allowNull: true }, // e.g. "September 2026"

  // Hours
  total_working_days:  { type: DataTypes.INTEGER, defaultValue: 0 },
  days_present:        { type: DataTypes.INTEGER, defaultValue: 0 },
  days_absent:         { type: DataTypes.INTEGER, defaultValue: 0 },
  days_leave:          { type: DataTypes.INTEGER, defaultValue: 0 },
  days_holiday:        { type: DataTypes.INTEGER, defaultValue: 0 },
  regular_hours:       { type: DataTypes.FLOAT,   defaultValue: 0 },
  overtime_hours:      { type: DataTypes.FLOAT,   defaultValue: 0 },

  // Salary components (amounts stored in local currency)
  basic_salary:        { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  hourly_rate:         { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  overtime_rate:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // per hour multiplier, e.g. 1.5
  overtime_pay:        { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

  // Allowances
  hra:                 { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // Housing
  transport:           { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  meals:               { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  medical:             { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  other_allowances:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_allowances:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

  // Deductions
  tax:                 { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  provident_fund:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  insurance:           { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  advance_deduction:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  late_deduction:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },  // penalty for late arrivals
  absent_deduction:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  other_deductions:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_deductions:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

  // Bonus & incentives
  performance_bonus:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  festival_bonus:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tips_shared:         { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

  // Gross / Net
  gross_salary:        { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  net_salary:          { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

  // Status & approval
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'paid', 'on_hold'),
    defaultValue: 'draft',
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'cheque', 'upi', 'other'),
    allowNull: true,
  },
  payment_reference: { type: DataTypes.STRING,  allowNull: true },
  payment_date:      { type: DataTypes.DATEONLY, allowNull: true },
  notes:             { type: DataTypes.TEXT,     allowNull: true },

  // Approval trail
  created_by:  { type: DataTypes.INTEGER, allowNull: true },
  approved_by: { type: DataTypes.INTEGER, allowNull: true },
  approved_at: { type: DataTypes.DATE,    allowNull: true },
  paid_by:     { type: DataTypes.INTEGER, allowNull: true },
  paid_at:     { type: DataTypes.DATE,    allowNull: true },
}, {
  tableName: 'payroll',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Payroll;
