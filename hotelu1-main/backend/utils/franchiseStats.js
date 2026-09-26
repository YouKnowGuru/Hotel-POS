const COMPLETED = ["completed", "delivered"];
const ACTIVE = ["pending", "preparing", "ready"];

function orderRow(o) {
  return o.toJSON ? o.toJSON() : o;
}

function sumTotals(orders) {
  return orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
}

function statsForOrders(locOrders) {
  const completed = locOrders.filter((o) => COMPLETED.includes(o.status));
  const active = locOrders.filter((o) => ACTIVE.includes(o.status));
  const pending = locOrders.filter((o) => o.status === "pending");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = locOrders.filter((o) => {
    const t = new Date(o.timestamp);
    return t >= todayStart;
  });
  const todayCompleted = todayOrders.filter((o) => COMPLETED.includes(o.status));

  const byType = {};
  locOrders.forEach((o) => {
    const t = o.type || "OTHER";
    if (!byType[t]) byType[t] = { count: 0, revenue: 0 };
    byType[t].count += 1;
    if (COMPLETED.includes(o.status)) byType[t].revenue += Number(o.total) || 0;
  });

  return {
    totalOrders: locOrders.length,
    completedOrders: completed.length,
    activeOrders: active.length,
    pendingOrders: pending.length,
    totalSales: sumTotals(completed),
    amountGenerated: sumTotals(completed),
    todaySales: sumTotals(todayCompleted),
    todayOrders: todayOrders.length,
    pendingAmount: sumTotals(pending),
    byType,
  };
}

function computeLocationStats(orders, subfranchiseId) {
  const all = orders.map(orderRow);
  let locOrders = all;
  if (subfranchiseId == null) {
    locOrders = all.filter((o) => o.subfranchise_id == null);
  } else {
    locOrders = all.filter(
      (o) => Number(o.subfranchise_id) === Number(subfranchiseId)
    );
  }
  return statsForOrders(locOrders);
}

function computeStatsFromOrderList(orders) {
  return statsForOrders(orders.map(orderRow));
}

function enrichSubFranchise(sf, orders, loginUser = null) {
  const base = sf.toJSON ? sf.toJSON() : { ...sf };
  const stats = computeLocationStats(orders, base.id);
  return {
    ...base,
    ...stats,
    loginUsername: loginUser?.username || null,
  };
}

module.exports = {
  COMPLETED,
  ACTIVE,
  computeLocationStats,
  computeStatsFromOrderList,
  enrichSubFranchise,
};
