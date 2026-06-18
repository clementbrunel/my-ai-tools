import { useEffect } from 'react';
import { useNavigationType } from 'react-router-dom';

export function useScrollRestoration(key: string, ready = true) {
  const navigationType = useNavigationType();

  useEffect(() => {
    const handleScroll = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [key]);

  useEffect(() => {
    if (navigationType !== 'POP' || !ready) return;
    const saved = sessionStorage.getItem(key);
    if (saved) requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
  }, [key, navigationType, ready]);
}
