"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function OccupancyChart({ data }) {
  // Use mock data if no data provided
  const chartData = data || [
    { name: 'Section A', occupied: 120, available: 40 },
    { name: 'Section B', occupied: 85, available: 60 },
    { name: 'Section C', occupied: 200, available: 15 },
    { name: 'Section D', occupied: 45, available: 110 },
  ];

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
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        barCategoryGap="25%"
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={80} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
        />
        <Legend content={renderLegend} />
        <Bar dataKey="occupied" name="Occupied plots" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
        <Bar dataKey="available" name="Available plots" fill="var(--color-border-strong)" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}
