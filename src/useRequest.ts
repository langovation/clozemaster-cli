import { useEffect, useState } from "react";

export type RequestState<T> = { data?: T; error?: Error; isLoading: boolean };

export function useRequest<T>(load: () => Promise<T>, dependencies: unknown[] = []): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ isLoading: true });
  useEffect(() => {
    let isCurrent = true;
    setState({ isLoading: true });
    load().then(
      (data) => isCurrent && setState({ data, isLoading: false }),
      (error) => isCurrent && setState({ error, isLoading: false }),
    );
    return () => {
      isCurrent = false;
    };
  }, dependencies);
  return state;
}
