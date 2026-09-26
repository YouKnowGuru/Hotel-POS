const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  user_name: { type: DataTypes.STRING, allowNull: false },
  user_role: { type: DataTypes.STRING, allowNull: false },
  subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  clock_in: { type: DataTypes.DATE, allowNull: true },
  clock_out: { type: DataTypes.DATE, allowNull: true },
  break_start: { type: DataTypes.DATE, allowNull: true },
  break_end: { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'late', 'half_day', 'leave', 'holiday'),
    allowNull: false,
    defaultValue: 'present',
  },
  leave_type: {
    type: DataTypes.ENUM('sick', 'casual', 'earned', 'unpaid', 'maternity', 'paternity', 'emergency'),
    allowNull: true,
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  // Computed fields (stored for quick lookup)
  total_hours: { type: DataTypes.FLOAT, allowNull: true },       // Total shift hours
  break_hours: { type: DataTypes.FLOAT, allowNull: true },       // Break duration hours
  net_hours: { type: DataTypes.FLOAT, allowNull: true },         // total_hours - break_hours
  overtime_hours: { type: DataTypes.FLOAT, allowNull: true },    // hours beyond standard shift
  // Shift details
  shift: {
    type: DataTypes.ENUM('morning', 'afternoon', 'evening', 'night', 'full_day', 'flexible'),
    allowNull: true,
    defaultValue: 'full_day',
  },
  expected_hours: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 8 },
  // Approval
  approved_by: { type: DataTypes.INTEGER, allowNull: true },
  approved_at: { type: DataTypes.DATE, allowNull: true },
  is_approved: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'attendance',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Attendance;
