"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function OccupancyChart({ data }) {
  const chartData = Array.isArray(data) ? data : [];

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: "100%", height: "100%", color: "var(--text-muted)", fontSize: "0.9rem" }}
      >
        No occupancy data available yet.
      </div>
    );
  }

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', justifyContent: 'center', gap: '20px', paddingTop: '10px', fontSize: '13px', margin: 0 }}>
        {payload.map((entry, index) => (
          <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span 
              style={{ 
                display: 'inline-block', 
                width: 12, 
                height: 12, 
                borderRadius: '50%', 
                backgroundColor: entry.color, 
                marginRight: 8,
                border: entry.dataKey === 'available' ? '1px solid rgba(255,255,255,0.4)' : 'none'
              }} 
            />
            {entry.value}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 15, right: 30, left: 10, bottom: 5 }}
        barCategoryGap="38%"
        barGap={3}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          dataKey="name"
          type="category"
          stroke="var(--text-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
        />
        <Legend content={renderLegend} />
        <Bar dataKey="occupied" name="Occupied plots" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={true} animationDuration={1000} />
        <Bar dataKey="available" name="Available plots" fill="#10B981" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={true} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}
