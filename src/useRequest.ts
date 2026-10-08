import { useEffect, useState } from "react";

export type RequestState<T> = { error?: Error; isLoading: boolean; result?: T };

export function useRequest<T>(load: () => Promise<T>, dependencies: unknown[] = []): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ isLoading: true });
  useEffect(() => {
    let isCurrent = true;
    setState({ isLoading: true });
    load().then(
      (result) => isCurrent && setState({ isLoading: false, result }),
      (error) => isCurrent && setState({ error, isLoading: false }),
    );
    return () => {
      isCurrent = false;
    };
  }, dependencies);
  return state;
}
