import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';

/** 간단한 GET 데이터 로더 */
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const r = await api.get(url);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}
