import { useState } from 'react';

type Msg = { type: 'success' | 'error'; text: string } | null;

export const useFormMessages = () => {
  const [msg, setMsg] = useState<Msg>(null);
  return {
    msg,
    setSuccess: (text: string) => setMsg({ type: 'success', text }),
    setError: (text: string) => setMsg({ type: 'error', text }),
    clear: () => setMsg(null),
  };
};
