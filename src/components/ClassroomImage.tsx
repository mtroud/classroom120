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
        className={`bg-gradient-to-br from-[#F0F4F9] via-[#F8FAFD] to-[#E8F0FE] flex flex-col items-center justify-center text-[#444746] p-4 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <MonitorPlay className="w-8 h-8 text-[#0B57D0]/80 mb-2" />
        <span className="text-xs font-medium text-[#1F1F1F] text-center line-clamp-1">
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
