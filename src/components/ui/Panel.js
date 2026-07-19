import React from 'react';

export function Panel({
  className = '',
  children,
  ...props
}) {
  const combinedClass = ['card', 'card-static', className].filter(Boolean).join(' ');

  return (
    <div className={combinedClass} {...props}>
      {children}
    </div>
  );
}
