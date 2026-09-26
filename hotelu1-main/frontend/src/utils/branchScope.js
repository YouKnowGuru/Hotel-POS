/** Helpers for multi-restaurant / branch scoping in the UI. */

export const isAdminUser = (user) =>
  String(user?.role || '').toLowerCase() === 'admin';

export const isBranchScopedUser = (user) => {
  if (!user) return false;
  if (isAdminUser(user)) return false;
  if (user.subfranchise_id != null) return true;
  const role = String(user.role || '').toLowerCase();
  return role === 'subfranchise';
};

export const getBranchLabel = (user) => {
  if (user?.branch?.name) return user.branch.name;
  if (isAdminUser(user)) return 'All Restaurants';
  if (user?.subfranchise_id != null) return `Branch #${user.subfranchise_id}`;
  return 'Main Branch / HQ';
};

export const getBranchSubLabel = (user) => {
  if (isAdminUser(user)) return 'Full dashboard · all locations';
  if (user?.branch?.code) return user.branch.code;
  if (user?.branch?.city) return user.branch.city;
  if (user?.subfranchise_id != null) return 'Your restaurant only';
  return 'Headquarters';
};
