import React from 'react';

interface PresenceBarProps {
  names: string[];
  className?: string;
}

const PresenceBar: React.FC<PresenceBarProps> = ({ names, className }) => {
  if (!names || names.length === 0) {
    return null;
  }

  return (
    <div
      className={`d-flex flex-wrap align-items-center gap-2 py-2 px-3 mb-3 shadow-sm rounded-pill bg-white border border-light ${className || ''}`.trim()}
      style={{
        maxWidth: '100%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      <span className="fw-semibold text-primary" style={{ color: '#1e3a5f' }}>
        Online now:
      </span>
      {names.map((name) => (
        <span
          key={name}
          className="px-3 py-1 rounded-pill"
          style={{
            background: '#e6f4ff',
            color: '#1e3a5f',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {name}
        </span>
      ))}
    </div>
  );
};

export default PresenceBar;

