import { StatusCode, STATUS_LABELS, STATUS_COLORS } from '../types';

interface StatusBadgeProps {
  status: StatusCode;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, text, size = 'md' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN;
  const label = text || STATUS_LABELS[status] || status;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${colorClass}
        ${sizeClasses[size]}
      `}
    >
      {label}
    </span>
  );
}

