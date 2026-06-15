import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFormMessages } from './useFormMessages';

describe('useFormMessages', () => {
  it('starts with empty error and success', () => {
    const { result } = renderHook(() => useFormMessages());
    expect(result.current.error).toBe('');
    expect(result.current.success).toBe('');
  });

  it('setError updates error and leaves success untouched', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setError('quelque chose a planté'));
    expect(result.current.error).toBe('quelque chose a planté');
    expect(result.current.success).toBe('');
  });

  it('setSuccess updates success and leaves error untouched', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setSuccess('opération réussie'));
    expect(result.current.success).toBe('opération réussie');
    expect(result.current.error).toBe('');
  });

  it('clear resets both fields to empty strings', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => {
      result.current.setError('err');
      result.current.setSuccess('ok');
    });
    act(() => result.current.clear());
    expect(result.current.error).toBe('');
    expect(result.current.success).toBe('');
  });

  it('clear on already-empty state does not throw', () => {
    const { result } = renderHook(() => useFormMessages());
    expect(() => act(() => result.current.clear())).not.toThrow();
  });

  it('multiple setError calls keep the last value', () => {
    const { result } = renderHook(() => useFormMessages());
    act(() => result.current.setError('première erreur'));
    act(() => result.current.setError('deuxième erreur'));
    expect(result.current.error).toBe('deuxième erreur');
  });
});
