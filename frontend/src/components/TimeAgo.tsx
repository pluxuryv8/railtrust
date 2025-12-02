import { useMemo } from 'react';

interface TimeAgoProps {
  date: string | Date;
  className?: string;
}

export default function TimeAgo({ date, className = '' }: TimeAgoProps) {
  const { text, color } = useMemo(() => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let text: string;
    let color: string;

    if (diffMins < 1) {
      text = 'только что';
      color = 'text-green-400';
    } else if (diffMins < 60) {
      text = `${diffMins} мин. назад`;
      color = 'text-green-400';
    } else if (diffHours < 24) {
      text = `${diffHours} ч. назад`;
      color = 'text-slate-400';
    } else if (diffDays < 3) {
      text = `${diffDays} дн. назад`;
      color = 'text-slate-400';
    } else if (diffDays < 7) {
      text = `${diffDays} дн. назад`;
      color = 'text-amber-400';
    } else {
      text = `${diffDays} дн. назад`;
      color = 'text-red-400';
    }

    return { text, color };
  }, [date]);

  return (
    <span className={`${color} ${className}`} title={new Date(date).toLocaleString('ru-RU')}>
      {text}
    </span>
  );
}

