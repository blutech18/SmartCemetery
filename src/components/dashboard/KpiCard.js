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

  const iconClass = `stat-icon stat-icon-${iconVariant}`;

  return (
    <CardComponent {...cardProps} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center justify-between">
        <div className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{title}</div>
        {Icon && (
          <Icon 
            size={28} 
            style={{ 
              color: iconVariant === 'primary' ? 'var(--primary-light)' : 
                     iconVariant === 'accent' ? 'var(--accent)' : 
                     iconVariant === 'warning' ? 'var(--warning)' : 
                     iconVariant === 'danger' ? 'var(--danger)' : 'inherit'
            }} 
          />
        )}
      </div>
      <div className="stat-value" style={{ marginBottom: 0, fontSize: '1.875rem' }}>{value}</div>
      {comparison && (
        <div className="text-xs text-muted" style={{ marginTop: 'auto' }}>
          {comparison}
        </div>
      )}
    </CardComponent>
  );
}
