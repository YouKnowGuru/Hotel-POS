/** Normalize table id from URL/input (e.g. "1", "T1") */
export function normalizeTableNum(tableId) {
  return String(tableId ?? "1")
    .replace(/^T/i, "")
    .trim();
}

export function formatTableName(tableId) {
  return `T${normalizeTableNum(tableId)}`;
}

export function tableNameVariants(tableId) {
  const t = normalizeTableNum(tableId);
  return [...new Set([String(tableId), t, `T${t}`, `Table ${t}`, `table ${t}`])];
}

export function tableIdMatches(tableId, tableName) {
  if (!tableName) return false;
  const variants = tableNameVariants(tableId);
  return variants.some(
    (v) => v.toLowerCase() === String(tableName).toLowerCase()
  );
}

/** Order still active on table until completed / not available */
export function isActiveTableOrder(order) {
  const s = (order.status || "").toLowerCase();
  return s !== "completed" && s !== "not_available";
}

export function getOrderPhaseLabel(order) {
  const s = (order.status || "").toLowerCase();
  if (s === "completed" || s === "not_available") return null;
  if (s === "delivered" || (s === "ready" && order.bill_requested)) {
    return "Waiting for billing";
  }
  if (s === "ready") return "Ready";
  if (s === "preparing") return "Preparing";
  if (s === "pending") return "Order received";
  return order.status || "Active";
}

export function getOrderPhaseClass(order) {
  const label = getOrderPhaseLabel(order);
  if (label === "Waiting for billing") return "bg-purple-100 text-purple-800 border-purple-400";
  if (label === "Ready") return "bg-green-100 text-green-800 border-green-400";
  if (label === "Preparing") return "bg-yellow-100 text-yellow-800 border-yellow-400";
  if (label === "Order received") return "bg-orange-100 text-orange-800 border-orange-400";
  return "bg-gray-100 text-gray-800 border-gray-400";
}
