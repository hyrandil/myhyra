import { useEffect, useState } from 'react';

function detectMobile() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(max-width: 900px)');
  const ua = navigator.userAgent || '';
  return mq.matches || /Mobi|Android|iPhone|iPad/i.test(ua);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => detectMobile());

  useEffect(() => {
    const detect = () => {
      setIsMobile(detectMobile());
    };
    detect();
    const mq = window.matchMedia('(max-width: 900px)');
    mq.addEventListener('change', detect);
    return () => mq.removeEventListener('change', detect);
  }, []);

  return isMobile;
}
