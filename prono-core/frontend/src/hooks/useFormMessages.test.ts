import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFormMessages } from './useFormMessages';

describe('useFormMessages', () => {
  it('starts with msg null', () => {
    const { result } = renderHook(() => useFormMessages());
    expect(result.current.msg).toBeNull();
  });

  it('setError sets msg with type error', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setError('quelque chose a planté'));
    expect(result.current.msg).toEqual({ type: 'error', text: 'quelque chose a planté' });
  });

  it('setSuccess sets msg with type success', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setSuccess('opération réussie'));
    expect(result.current.msg).toEqual({ type: 'success', text: 'opération réussie' });
  });

  it('clear resets msg to null', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setError('err'));
    act(() => result.current.clear());
    expect(result.current.msg).toBeNull();
  });

  it('clear on already-null state does not throw', () => {
    const { result } = renderHook(() => useFormMessages());
    expect(() => act(() => result.current.clear())).not.toThrow();
  });

  it('setError after setSuccess replaces the message', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setSuccess('ok'));
    act(() => result.current.setError('echec'));
    expect(result.current.msg).toEqual({ type: 'error', text: 'echec' });
  });

  it('multiple setError calls keep the last value', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setError('première erreur'));
    act(() => result.current.setError('deuxième erreur'));
    expect(result.current.msg?.text).toBe('deuxième erreur');
  });
});
