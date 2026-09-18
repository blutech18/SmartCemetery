import React from 'react';
import Link from 'next/link';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';

export function KpiCard({
  title,
  value,
  comparison,
  icon: Icon,
  iconVariant = 'primary', // primary, accent, warning, danger
  href,
  className = '',
  loading = false,
}) {
  const CardComponent = href ? Link : 'div';
  const cardProps = href ? { href, className: `stat-card block ${className}` } : { className: `stat-card ${className}` };

  if (loading) {
    return (
      <Panel className={`flex flex-col ${className}`}>
        <Skeleton style={{ width: '48px', height: '48px', marginBottom: '16px', borderRadius: '10px' }} />
        <Skeleton style={{ width: '60%', height: '32px', marginBottom: '8px' }} />
        <Skeleton style={{ width: '40%', height: '16px' }} />
      </Panel>
    );
  }

  const iconColors = {
    primary: 'var(--primary-light)',
    accent: 'var(--accent)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  };
  const iconColor = iconColors[iconVariant] || iconColors.primary;

  return (
    <CardComponent {...cardProps} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="flex items-center justify-between">
        <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{title}</div>
        {Icon && (
          <Icon size={24} style={{ color: iconColor, flexShrink: 0 }} />
        )}
      </div>
      <div className="stat-value" style={{ marginBottom: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
        {value}
      </div>
      {comparison && (
        <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
          {typeof comparison === 'string' ? (
            <div className="text-xs text-muted">{comparison}</div>
          ) : (
            comparison
          )}
        </div>
      )}
    </CardComponent>
  );
}
