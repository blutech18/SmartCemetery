import React from 'react';

export function Badge({
  variant = 'muted', // primary, success, warning, danger, info, muted
  className = '',
  children,
  ...props
}) {
  const baseClass = 'badge';
  
  const variants = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    muted: 'badge-muted',
  };

  const combinedClass = [
    baseClass,
    variants[variant] || variants.muted,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={combinedClass} {...props}>
      {children}
    </span>
  );
}
