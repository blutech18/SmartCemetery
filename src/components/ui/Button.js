import React from 'react';
import Link from 'next/link';

export function Button({
  variant = 'primary', // primary, secondary, ghost, destructive, link, icon
  size = 'md', // sm, md, lg, icon
  className = '',
  loading = false,
  disabled = false,
  href,
  children,
  ...props
}) {
  const baseClass = 'btn';
  
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    destructive: 'btn-danger',
    link: 'btn-link',
    icon: 'btn-icon',
  };
  
  const sizes = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
    icon: '',
  };

  const combinedClass = [
    baseClass,
    variants[variant] || variants.primary,
    (variant !== 'link' && variant !== 'icon') ? (sizes[size] || '') : '',
    className
  ].filter(Boolean).join(' ');

  if (href) {
    return (
      <Link href={href} className={combinedClass} {...props}>
        {loading ? <span className="mr-2" aria-hidden="true">◓</span> : null}
        {children}
      </Link>
    );
  }

  return (
    <button
      className={combinedClass}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className="mr-2" aria-hidden="true">◓</span> : null}
      {children}
    </button>
  );
}
