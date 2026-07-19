"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3, Download, Navigation, Calendar, Activity, ArrowRight, RefreshCw, Layers } from "lucide-react";
import { PageHeader } from "../../../components/dashboard/PageHeader";
import { KpiCard } from "../../../components/dashboard/KpiCard";
import { Panel } from "../../../components/ui/Panel";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";

function dateInput(date) { return date.toISOString().slice(0, 10); }

function formatActionName(action) {
  if (!action) return "Unknown Action";
  const parts = action.split('.');
  if (parts.length === 2) {
    const noun = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const verb = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${verb} ${noun}`;
  }
  return action.charAt(0).toUpperCase() + action.slice(1);
}

const COLORS = ['#2ECC71', '#3B82F6', '#FFB547', '#FF6B6B', '#8B5CF6', '#4ECDC4', '#E83E8C'];

export default function AnalyticsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  
  const today = dateInput(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 29);
  
  const [from, setFrom] = useState(dateInput(start));
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(`/api/analytics?${query}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || body?.error || "Failed to load analytics.");
      setData(body);
    } catch (loadError) {
      setError(loadError.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAdmin) {
      void Promise.resolve().then(load);
    }
  }, [isAdmin, load, sessionStatus]);

  const csvHref = `/api/analytics?${new URLSearchParams({ from, to, format: "csv" })}`;
  const pdfHref = `/api/analytics?${new URLSearchParams({ from, to, format: "pdf" })}`;
  const xlsxHref = `/api/analytics?${new URLSearchParams({ from, to, format: "xlsx" })}`;

  if (sessionStatus === "loading") {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "50vh" }}>
        <div className="spinner spinner-lg text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in" style={{ padding: "var(--space-xl)" }}>
        <Panel className="alert-panel" style={{ border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.1)" }}>
          <div className="flex items-center gap-md">
            <Activity size={24} style={{ color: "var(--danger)" }} />
            <div>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Access Denied</h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>Admin access is required to view operations analytics.</p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  // Format data for charts
  const auditData = data?.auditActions?.map(d => ({ name: formatActionName(d.action), value: d.count })) || [];
  const dailyData = data?.navigation?.daily?.map(d => ({ date: d.date, count: d.count })) || [];
  const channelData = data?.navigation?.channels?.map(d => ({ name: d.channel, value: d.count })) || [];
  const destData = data?.navigation?.destinations?.map(d => ({ name: d.destination, value: d.count })) || [];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", paddingBottom: "var(--space-2xl)" }}>
      <PageHeader 
        title="Operations Analytics"
        description="Privacy-safe audit and navigation aggregates."
        actions={
          <div className="flex gap-sm">
            <a className="btn btn-ghost flex items-center gap-xs" href={csvHref} title="Download CSV">
              <Download size={16} /> CSV
            </a>
            <a className="btn btn-ghost flex items-center gap-xs" href={pdfHref} title="Download PDF">
              <Download size={16} /> PDF
            </a>
            <a className="btn btn-primary flex items-center gap-xs" href={xlsxHref} title="Download XLSX">
              <Download size={16} /> XLSX
            </a>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Panel className="flex items-center justify-between flex-wrap gap-md" style={{ padding: "16px 24px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-xl flex-wrap">
          <div className="flex items-center gap-sm">
            <Calendar size={18} className="text-muted" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Date Range</span>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <input 
              className="form-input" 
              type="date" 
              value={from} 
              max={to} 
              onChange={(e) => setFrom(e.target.value)} 
              style={{ width: 160, padding: "8px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", colorScheme: "dark" }}
            />
            <ArrowRight size={14} className="text-muted" />
            <input 
              className="form-input" 
              type="date" 
              value={to} 
              min={from} 
              onChange={(e) => setTo(e.target.value)} 
              style={{ width: 160, padding: "8px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", colorScheme: "dark" }}
            />
          </div>
        </div>
        <button className="btn btn-ghost flex items-center gap-xs" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
        </button>
      </Panel>

      {error && (
        <Panel style={{ border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.05)" }}>
          <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
        </Panel>
      )}

      {/* KPI Cards */}
      <div className="grid grid-2 gap-lg">
        <KpiCard
          loading={loading}
          title="Total Audit Actions"
          value={data?.totals?.auditActions || 0}
          icon={BarChart3}
          iconVariant="primary"
        />
        <KpiCard
          loading={loading}
          title="Total Navigation Events"
          value={data?.totals?.navigations || 0}
          icon={Navigation}
          iconVariant="accent"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-2 gap-lg" style={{ marginTop: "var(--space-md)" }}>
        <ChartPanel 
          loading={loading}
          title="Audit Actions Breakdown" 
          icon={Activity}
          data={auditData}
          type="pie"
        />
        <ChartPanel 
          loading={loading}
          title="Navigation by Day" 
          icon={Calendar}
          data={dailyData}
          type="area"
          dataKey="count"
          nameKey="date"
        />
        <ChartPanel 
          loading={loading}
          title="Navigation Channels" 
          icon={Layers}
          data={channelData}
          type="pie"
        />
        <ChartPanel 
          loading={loading}
          title="Destination Groups" 
          icon={Navigation}
          data={destData}
          type="bar"
          dataKey="value"
          nameKey="name"
        />
      </div>
    </div>
  );
}

function ChartPanel({ title, data, type, loading, icon: Icon, dataKey = "value", nameKey = "name" }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <p style={{ margin: '0 0 6px 0', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{label || payload[0].name}</p>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
            {payload[0].value} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>events</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
      <div className="flex items-center gap-sm" style={{ padding: "var(--space-lg)", borderBottom: "1px solid var(--border-default)", background: "rgba(255, 255, 255, 0.02)" }}>
        {Icon && <Icon size={18} className="text-primary" />}
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{title}</h3>
      </div>
      
      <div style={{ padding: "var(--space-lg)", flex: 1, minHeight: 320, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div className="flex flex-col gap-sm justify-center h-full" style={{ flex: 1 }}>
            <Skeleton style={{ height: "100%", width: "100%", borderRadius: "var(--radius-md)" }} />
          </div>
        ) : data && data.length > 0 ? (
          <div style={{ flex: 1, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              {type === 'area' && (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey={nameKey} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey={dataKey} stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              )}
              
              {type === 'bar' && (
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey={nameKey} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={dataKey} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              )}

              {type === 'pie' && (
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey={dataKey}
                    nameKey={nameKey}
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>{value}</span>}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ opacity: 0.6, flex: 1 }}>
            <Activity size={32} style={{ marginBottom: "var(--space-sm)", color: "var(--text-muted)" }} />
            <p className="text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>No events recorded for this period.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
