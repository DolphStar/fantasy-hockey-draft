import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic retry logic.
 * Reloads the page once if a chunk fails to load (e.g. after a new deploy).
 */
export const lazyWithRetry = (
  componentImport: () => Promise<{ default: ComponentType<any> }>
) => {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        console.warn('Chunk load failed. Reloading to grab latest assets...');
        window.location.reload();
        return { default: () => null };
      }

      throw error;
    }
  });
};
