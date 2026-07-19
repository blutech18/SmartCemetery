import React from 'react';

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`}>
      <div className="flex flex-col gap-xs">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-sm">
            <ol className="flex items-center gap-sm text-sm text-muted">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center gap-sm">
                  {crumb.href ? (
                    <a href={crumb.href} style={{ color: "var(--primary)" }}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span style={{ color: "var(--text-primary)" }}>{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <span aria-hidden="true">/</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-md mt-md">
          {actions}
        </div>
      )}
    </div>
  );
}
