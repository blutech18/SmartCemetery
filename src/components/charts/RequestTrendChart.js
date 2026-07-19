"use client";

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function RequestTrendChart({ data }) {
  // Use mock data if no data provided
  const chartData = data || [
    { date: '1', received: 12, completed: 10 },
    { date: '5', received: 15, completed: 14 },
    { date: '10', received: 8, completed: 12 },
    { date: '15', received: 22, completed: 18 },
    { date: '20', received: 18, completed: 20 },
    { date: '25', received: 25, completed: 22 },
    { date: '30', received: 14, completed: 19 },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Area type="monotone" dataKey="received" stroke="var(--primary)" fillOpacity={1} fill="url(#colorReceived)" name="Received" strokeWidth={2} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
        <Area type="monotone" dataKey="completed" stroke="var(--success)" fillOpacity={1} fill="url(#colorCompleted)" name="Completed" strokeWidth={2} isAnimationActive={true} animationDuration={1500} animationEasing="ease-out" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
