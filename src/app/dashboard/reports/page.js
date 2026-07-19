"use client";

import { useState, useEffect, useRef } from "react";
import { Archive, MapPin, Map, Users, BarChart3, Download, Calendar, FileText, Printer, CheckCircle2, XCircle, Clock, Wrench, TrendingUp, ShieldCheck } from "lucide-react";
import { KpiCard } from "../../../components/dashboard/KpiCard";
import { Panel } from "../../../components/ui/Panel";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const PLOT_COLORS = { available: '#2ECC71', occupied: '#3B82F6', reserved: '#F59E0B', maintenance: '#64748B' };
const GRAVE_COLORS = { active: '#3B82F6', archived: '#64748B' };
const REQUEST_COLORS = { pending: '#F59E0B', approved: '#2ECC71', rejected: '#EF4444' };
const VERIFICATION_COLORS = { verified: '#2ECC71', pending: '#F59E0B', rejected: '#EF4444' };

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-md)' }}>
        <p style={{ margin: '0 0 4px 0', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{payload[0].name}</p>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
}

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const reportRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);

    fetch(`/api/reports/stats${query.size ? `?${query}` : ""}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || body?.error || "Failed to load report");
        return body;
      })
      .then((body) => {
        setStats(body);
        setError("");
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [from, to]);

  const exportHref = (format) => {
    const query = new URLSearchParams({ format });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return `/api/reports/export?${query}`;
  };

  const handlePrint = () => window.print();

  const periodLabel = from && to
    ? `${new Date(from).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} — ${new Date(to).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
    : from
    ? `From ${new Date(from).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
    : to
    ? `Until ${new Date(to).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
    : "All Time";

  const generatedAt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Raw grave rows for client-side aggregation
  const rawGraves = stats?.rawGraves || [];

  // Prepare chart data
  const graveChartData = [
    { name: 'Active', value: stats?.graves?.active || 0 },
    { name: 'Archived', value: stats?.graves?.archived || 0 }
  ];

  const plotChartData = [
    { name: 'Available', value: stats?.plots?.available || 0 },
    { name: 'Occupied', value: stats?.plots?.occupied || 0 },
    { name: 'Reserved', value: stats?.plots?.reserved || 0 },
    { name: 'Maintenance', value: stats?.plots?.maintenance || 0 }
  ];

  const requestChartData = [
    { name: 'Pending', value: stats?.requests?.byStatus?.pending || 0 },
    { name: 'Approved', value: stats?.requests?.byStatus?.approved || 0 },
    { name: 'Rejected', value: stats?.requests?.byStatus?.rejected || 0 }
  ];

  // Burial Statistics by Period â€” aggregate raw grave rows by month
  const burialsByMonth = (() => {
    if (!rawGraves || rawGraves.length === 0) return [];
    const monthMap = {};
    for (const g of rawGraves) {
      if (!g.burialDate) continue;
      const d = new Date(g.burialDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + 1;
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  })();

  // Record Verification Status
  const verificationData = (() => {
    if (!rawGraves || rawGraves.length === 0) return { verified: 0, pending: 0, rejected: 0, total: 0 };
    let verified = 0, pending = 0, rejected = 0;
    for (const g of rawGraves) {
      if (g.verificationStatus === 'verified') verified++;
      else if (g.verificationStatus === 'rejected') rejected++;
      else pending++;
    }
    return { verified, pending, rejected, total: rawGraves.length };
  })();

  const verificationChartData = [
    { name: 'Verified', value: verificationData.verified },
    { name: 'Pending', value: verificationData.pending },
    { name: 'Rejected', value: verificationData.rejected }
  ];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", paddingBottom: "var(--space-2xl)" }}>
      {/* === PRINTABLE REPORT BODY === */}
      <div ref={reportRef}>
        <Panel
          className="report-workspace-header"
          role="region"
          aria-labelledby="operations-report-title"
          style={{ marginBottom: "var(--space-lg)" }}
        >
          <div className="report-workspace-header__top">
            <div className="report-workspace-header__identity">
              <div className="report-workspace-header__eyebrow">
                <FileText size={14} aria-hidden="true" />
                <span>Bolonsori Public Cemetery</span>
              </div>
              <h1 id="operations-report-title" className="report-workspace-header__title">
                Operations Report
              </h1>
              <p className="report-workspace-header__description">
                Consolidated operational data for cemetery records, plots, service requests, and verification activity.
              </p>
            </div>

            <div className="report-workspace-header__actions" aria-label="Report actions">
              <button className="btn btn-ghost" type="button" onClick={handlePrint}>
                <Printer size={16} /> Print
              </button>
              <a className="btn btn-ghost" href={exportHref("pdf")}>
                <Download size={16} /> PDF
              </a>
              <a className="btn btn-primary" href={exportHref("excel")}>
                <Download size={16} /> XLSX
              </a>
            </div>
          </div>

          <div className="report-workspace-header__parameters">
            <div className="report-parameter report-parameter--period">
              <span className="report-parameter__label">
                <Calendar size={14} aria-hidden="true" /> Current reporting period
              </span>
              <strong className="report-parameter__value">{periodLabel}</strong>
            </div>

            <label className="report-parameter report-parameter--date">
              <span className="report-parameter__label">Start date</span>
              <input
                className="form-input report-parameter__input"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setLoading(true);
                  setError("");
                  setFrom(e.target.value);
                }}
                aria-label="Report start date"
              />
            </label>

            <label className="report-parameter report-parameter--date">
              <span className="report-parameter__label">End date</span>
              <input
                className="form-input report-parameter__input"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setLoading(true);
                  setError("");
                  setTo(e.target.value);
                }}
                aria-label="Report end date"
              />
            </label>

            <div className="report-parameter report-parameter--generated">
              <span className="report-parameter__label">Generated</span>
              <span className="report-parameter__value">{generatedAt}</span>
            </div>

            <button
              className="btn btn-ghost report-parameter__reset"
              type="button"
              disabled={!from && !to}
              onClick={() => {
                setLoading(true);
                setError("");
                setFrom("");
                setTo("");
              }}
            >
              Reset
            </button>
          </div>
        </Panel>

        {error && (
          <Panel style={{ border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.05)", marginBottom: "var(--space-lg)" }}>
            <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
          </Panel>
        )}

        {/* Section 1: Summary Overview KPI */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <BarChart3 size={18} className="text-primary" /> 1. Summary Overview
          </h3>
          <div className="grid grid-4 gap-lg">
            <KpiCard loading={loading} title="Total Graves" value={stats?.graves?.total || 0} icon={Archive} iconVariant="primary" />
            <KpiCard loading={loading} title="Total Plots" value={stats?.plots?.total || 0} icon={MapPin} iconVariant="accent" />
            <KpiCard loading={loading} title="Locations" value={stats?.locations || 0} icon={Map} iconVariant="warning" />
            <KpiCard loading={loading} title="System Users" value={stats?.users || 0} icon={Users} iconVariant="danger" />
          </div>
        </div>

        {/* Section 2: Grave Records Status */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <Archive size={18} className="text-primary" /> 2. Grave Records Status
          </h3>
          <div className="grid grid-2 gap-lg">
            {/* Chart */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center gap-sm sync-header">
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Status Distribution</h4>
              </div>
              <div style={{ padding: "var(--space-lg)", height: 280 }}>
                {loading ? <Skeleton style={{ height: "100%", width: "100%" }} /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={graveChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                        {graveChartData.map((entry) => (
                          <Cell key={entry.name} fill={GRAVE_COLORS[entry.name.toLowerCase()]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
            {/* Table */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ width: "100%", height: 336, overflow: "hidden" }}>
                <table className="table report-table" style={{ width: "100%", height: "100%" }}>
                  <thead>
                    <tr style={{ height: "56px" }}>
                      <th className="sync-header">Status</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Count</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Active Records", value: stats?.graves?.active || 0, color: GRAVE_COLORS.active },
                      { label: "Archived Records", value: stats?.graves?.archived || 0, color: GRAVE_COLORS.archived }
                    ].map(item => (
                      <tr key={item.label}>
                        <td>
                          <div className="flex items-center gap-sm">
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            {item.label}
                          </div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{item.value}</td>
                        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          {verificationData.total > 0 ? Math.round((item.value / verificationData.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                    <tr className="filler-row" style={{ height: "100%" }}><td colSpan={5} style={{ padding: 0, border: 0, background: "transparent", height: "100%" }}>&nbsp;</td></tr>
                  </tbody>
                  <tfoot style={{ height: '56px' }}>
                    <tr style={{ borderTop: "2px solid var(--border-default)", height: "56px" }}>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{verificationData.total}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Section 3: Plot Utilization */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <MapPin size={18} className="text-accent" /> 3. Plot Utilization
          </h3>
          <div className="grid grid-2 gap-lg">
            {/* Chart */}
            <Panel style={{ padding: 0, overflow: "hidden", position: "relative" }}>
              <div className="flex items-center gap-sm sync-header">
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Utilization Chart</h4>
              </div>
              <div style={{ padding: "var(--space-lg)", height: 280, position: "relative" }}>
                {loading ? <Skeleton style={{ height: "100%", width: "100%" }} /> : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={plotChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                          {plotChartData.map((entry) => (
                            <Cell key={entry.name} fill={PLOT_COLORS[entry.name.toLowerCase()]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", textAlign: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1 }}>{stats?.plots?.occupancyRate || 0}%</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Occupied</div>
                    </div>
                  </>
                )}
              </div>
            </Panel>
            {/* Table */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ width: "100%", height: 336, overflow: "hidden" }}>
                <table className="table report-table" style={{ width: "100%", height: "100%" }}>
                  <thead>
                    <tr style={{ height: "56px" }}>
                      <th className="sync-header">Status</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Count</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Available", value: stats?.plots?.available || 0, color: PLOT_COLORS.available, icon: CheckCircle2 },
                      { label: "Occupied", value: stats?.plots?.occupied || 0, color: PLOT_COLORS.occupied, icon: Archive },
                      { label: "Reserved", value: stats?.plots?.reserved || 0, color: PLOT_COLORS.reserved, icon: Clock },
                      { label: "Maintenance", value: stats?.plots?.maintenance || 0, color: PLOT_COLORS.maintenance, icon: Wrench }
                    ].map(item => (
                      <tr key={item.label}>
                        <td>
                          <div className="flex items-center gap-sm">
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            {item.label}
                          </div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{item.value}</td>
                        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          {(stats?.plots?.total || 0) > 0 ? Math.round((item.value / stats.plots.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                      <tr className="filler-row" style={{ height: "100%" }}><td colSpan={5} style={{ padding: 0, border: 0, background: "transparent", height: "100%" }}>&nbsp;</td></tr>
                  </tbody>
                  <tfoot style={{ height: '56px' }}>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{stats?.plots?.total || 0}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Section 4: Request Status Overview */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <FileText size={18} style={{ color: "#F59E0B" }} /> 4. Request Status Overview
          </h3>
          <div className="grid grid-2 gap-lg">
            {/* Bar Chart */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center gap-sm sync-header">
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Requests by Status</h4>
              </div>
              <div style={{ padding: "var(--space-lg)", height: 280 }}>
                {loading ? <Skeleton style={{ height: "100%", width: "100%" }} /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={requestChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {requestChartData.map((entry) => (
                          <Cell key={entry.name} fill={REQUEST_COLORS[entry.name.toLowerCase()]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
            {/* Table */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ width: "100%", height: 336, overflow: "hidden" }}>
                <table className="table report-table" style={{ width: "100%", height: "100%" }}>
                  <thead>
                    <tr style={{ height: "56px" }}>
                      <th className="sync-header">Status</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Count</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Pending", value: stats?.requests?.byStatus?.pending || 0, color: REQUEST_COLORS.pending },
                      { label: "Approved", value: stats?.requests?.byStatus?.approved || 0, color: REQUEST_COLORS.approved },
                      { label: "Rejected", value: stats?.requests?.byStatus?.rejected || 0, color: REQUEST_COLORS.rejected }
                    ].map(item => (
                      <tr key={item.label}>
                        <td>
                          <div className="flex items-center gap-sm">
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            {item.label}
                          </div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{item.value}</td>
                        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          {(stats?.requests?.total || 0) > 0 ? Math.round((item.value / stats.requests.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                      <tr className="filler-row" style={{ height: "100%" }}><td colSpan={5} style={{ padding: 0, border: 0, background: "transparent", height: "100%" }}>&nbsp;</td></tr>
                  </tbody>
                  <tfoot style={{ height: '56px' }}>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{stats?.requests?.total || 0}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Section 5: Burial Statistics by Period */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <TrendingUp size={18} style={{ color: "#8B5CF6" }} /> 5. Burial Statistics by Period
          </h3>
          <div className="grid grid-2 gap-lg">
            {/* Chart */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center gap-sm sync-header">
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Monthly Burial Trend</h4>
              </div>
              <div style={{ padding: "var(--space-lg)", height: 280 }}>
                {loading ? <Skeleton style={{ height: "100%", width: "100%" }} /> : burialsByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={burialsByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="burialGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="count" fill="url(#burialGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full" style={{ opacity: 0.5 }}>
                    <TrendingUp size={32} className="text-muted" style={{ marginBottom: 8 }} />
                    <p className="text-muted text-sm" style={{ margin: 0 }}>No burial dates recorded for this period.</p>
                  </div>
                )}
              </div>
            </Panel>
            {/* Table */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ width: "100%", height: 336, overflow: "hidden" }}>
                <table className="table report-table" style={{ width: "100%", height: "100%" }}>
                  <thead>
                    <tr style={{ height: "56px" }}>
                      <th className="sync-header">Month</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {burialsByMonth.length > 0 ? burialsByMonth.map(item => (
                      <tr key={item.month}>
                        <td>{item.month}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{item.count}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} style={{ textAlign: "center", color: "var(--text-muted)" }}>No data available</td></tr>
                    )}
                                        <tr className="filler-row" style={{ height: "100%" }}><td colSpan={5} style={{ padding: 0, border: 0, background: "transparent", height: "100%" }}>&nbsp;</td></tr>
                  </tbody>
                  {burialsByMonth.length > 0 && (
                    <tfoot style={{ height: '56px' }}>
                      <tr>
                        <td style={{ fontWeight: 700 }}>Total</td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{burialsByMonth.reduce((s, r) => s + r.count, 0)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Section 6: Record Verification Status */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <ShieldCheck size={18} style={{ color: "#4ECDC4" }} /> 6. Record Verification Status
          </h3>
          <div className="grid grid-2 gap-lg">
            {/* Chart */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center gap-sm sync-header">
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Verification Distribution</h4>
              </div>
              <div style={{ padding: "var(--space-lg)", height: 280, position: "relative" }}>
                {loading ? <Skeleton style={{ height: "100%", width: "100%" }} /> : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={verificationChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                          {verificationChartData.map((entry) => (
                            <Cell key={entry.name} fill={VERIFICATION_COLORS[entry.name.toLowerCase()]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", textAlign: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1 }}>{verificationData.total > 0 ? Math.round((verificationData.verified / verificationData.total) * 100) : 0}%</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Verified</div>
                    </div>
                  </>
                )}
              </div>
            </Panel>
            {/* Table */}
            <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              <div style={{ width: "100%", height: 336, overflow: "hidden" }}>
                <table className="table report-table" style={{ width: "100%", height: "100%" }}>
                  <thead>
                    <tr style={{ height: "56px" }}>
                      <th className="sync-header">Status</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Count</th>
                      <th className="sync-header" style={{ textAlign: "center" }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Verified", value: verificationData.verified, color: VERIFICATION_COLORS.verified },
                      { label: "Pending Review", value: verificationData.pending, color: VERIFICATION_COLORS.pending },
                      { label: "Rejected", value: verificationData.rejected, color: VERIFICATION_COLORS.rejected }
                    ].map(item => (
                      <tr key={item.label}>
                        <td>
                          <div className="flex items-center gap-sm">
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            {item.label}
                          </div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{item.value}</td>
                        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          {verificationData.total > 0 ? Math.round((item.value / verificationData.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                    <tr className="filler-row" style={{ height: "100%" }}><td colSpan={5} style={{ padding: 0, border: 0, background: "transparent", height: "100%" }}>&nbsp;</td></tr>
                  </tbody>
                  <tfoot style={{ height: '56px' }}>
                    <tr style={{ borderTop: "2px solid var(--border-default)", height: "56px" }}>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{verificationData.total}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Report Footer */}
        <Panel style={{ padding: "20px 32px", background: "rgba(255, 255, 255, 0.02)", borderTop: "2px solid var(--border-default)" }}>
          <div className="flex items-center justify-between flex-wrap gap-sm text-xs text-muted">
            <span>Smart Cemetery Navigation and Monitoring Platform â€” Bolonsori Public Cemetery</span>
            <span>Report generated on {generatedAt}</span>
          </div>
        </Panel>

      </div>
    </div>
  );
}
