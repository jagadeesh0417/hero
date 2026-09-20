'use client';
import { useRef, useCallback } from 'react';

export function useRequestGuard() {
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const guard = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      return await fn();
    } finally {
      if (mountedRef.current) busyRef.current = false;
    }
  }, []);

  const isBusy = () => busyRef.current;

  return { guard, isBusy };
}
