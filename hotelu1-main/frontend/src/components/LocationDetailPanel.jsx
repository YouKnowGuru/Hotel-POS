import React, { useState, useEffect, useCallback } from "react";
import { X, RefreshCw, DollarSign, ShoppingBag, Calendar } from "lucide-react";
import { authFetch } from "../utils/api";
import useCurrency from "../hooks/useCurrency";

const LocationDetailPanel = ({ locationId, locationSettings, onClose }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await authFetch(`/api/subfranchises/${locationId}/detail`);
      if (!res.ok) throw new Error("Failed to load location details");
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (!locationId) return null;

  const loc = data?.location || {};
  const stats = data?.stats || loc;
  const orders = data?.recentOrders || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white">{loc.name || "Location"}</h3>
            <p className="text-orange-100 text-sm">
              {loc.city} · Code: {loc.code}
              {data?.loginUsername && ` · Login: ${data.loginUsername}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/90 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading && !data ? (
            <p className="text-center text-gray-500 py-8">Loading sales data...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Total Sales", value: fmt(stats.totalSales), icon: DollarSign },
                  { label: "Today", value: fmt(stats.todaySales), icon: Calendar },
                  { label: "Active Orders", value: stats.activeOrders ?? 0, icon: ShoppingBag },
                  { label: "All Orders", value: stats.totalOrders ?? 0, icon: ShoppingBag },
                ].map((c) => (
                  <div key={c.label} className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                    <c.icon className="w-4 h-4 text-orange-500 mb-1" />
                    <p className="text-xs text-gray-600">{c.label}</p>
                    <p className="text-lg font-bold text-gray-900">{c.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-gray-800 mb-2">Revenue breakdown</p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Amount generated (completed)</span>
                    <span className="font-medium text-green-700">{fmt(stats.amountGenerated)}</span>
                  </p>
                  <p className="flex justify-between mt-1">
                    <span className="text-gray-600">Pending amount</span>
                    <span className="font-medium text-amber-700">{fmt(stats.pendingAmount)}</span>
                  </p>
                  <p className="flex justify-between mt-1">
                    <span className="text-gray-600">Completed orders</span>
                    <span>{stats.completedOrders ?? 0}</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-semibold text-gray-800 mb-2">By order type</p>
                  {stats.byType && Object.keys(stats.byType).length > 0 ? (
                    Object.entries(stats.byType).map(([type, v]) => (
                      <p key={type} className="flex justify-between text-gray-700">
                        <span>{type}</span>
                        <span>
                          {v.count} orders · {fmt(v.revenue)}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="text-gray-500">No orders yet for this location</p>
                  )}
                </div>
              </div>

              <h4 className="font-bold text-gray-800 mb-2">Recent orders</h4>
              {orders.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-xl">
                  No orders linked to this location yet. Orders placed while logged in as
                  this franchise user will appear here.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">#</th>
                        <th className="text-left p-3">Table</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-right p-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-t border-gray-100">
                          <td className="p-3">{o.id}</td>
                          <td className="p-3">{o.table_name}</td>
                          <td className="p-3">{o.type}</td>
                          <td className="p-3 capitalize">{o.status}</td>
                          <td className="p-3 text-right font-medium">{fmt(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 border border-orange-200 rounded-lg text-orange-600 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationDetailPanel;
