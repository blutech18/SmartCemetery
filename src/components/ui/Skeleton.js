import React from 'react';

export function Skeleton({ className = '', style }) {
  return (
    <div 
      className={`skeleton ${className}`} 
      style={style} 
      aria-hidden="true" 
    />
  );
}
