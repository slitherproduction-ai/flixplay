import { useCallback, useEffect, useState } from "react";

export function useScreenLoad(label: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 180);
      });
    } catch (loadError) {
      console.error(`Falha ao carregar ${label}`, loadError);
      setError(`Não foi possível carregar ${label}.`);
    } finally {
      setLoading(false);
    }
  }, [label]);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, retry: load };
}
