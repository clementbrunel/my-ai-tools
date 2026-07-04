import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  fallbackText: string;
  sizeClassName: string;
  containerClassName?: string;
}

export default function Avatar({ src, alt, fallbackText, sizeClassName, containerClassName = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  return (
    <div className={`${sizeClassName} rounded-full flex items-center justify-center ${containerClassName}`}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={`${sizeClassName} rounded-full object-cover`}
          onError={() => setFailed(true)}
        />
      ) : (
        fallbackText
      )}
    </div>
  );
}
