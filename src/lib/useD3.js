import { useEffect, useRef } from 'react';

export default function useD3(render, deps) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    element.innerHTML = '';
    const cleanup = render(element);

    return () => {
      if (typeof cleanup === 'function') cleanup();
      element.innerHTML = '';
    };
  }, deps);

  return ref;
}
