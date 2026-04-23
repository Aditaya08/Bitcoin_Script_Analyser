import { useState, useCallback } from 'react';

export function useCopyToClipboard(): [(text: string) => void, boolean] {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback((text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 1500);
    }).catch((error) => {
      console.warn('Copy failed', error);
      setIsCopied(false);
    });
  }, []);

  return [copy, isCopied];
}
