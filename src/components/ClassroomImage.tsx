import { useState } from 'react';
import { MonitorPlay } from 'lucide-react';

interface ClassroomImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ClassroomImage({ src, alt, className = '' }: ClassroomImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50/60 flex flex-col items-center justify-center text-slate-500 p-4 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <MonitorPlay className="w-8 h-8 text-teal-700/70 mb-2" />
        <span className="text-xs font-medium text-slate-600 text-center line-clamp-1">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
