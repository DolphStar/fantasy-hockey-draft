import { useState, useEffect } from 'react';

/**
 * Hook to determine number of columns based on screen width
 * Matches Tailwind breakpoints:
 * - Mobile: 1 column (< 768px)
 * - Tablet: 2 columns (768px - 1024px)
 * - Desktop: 3 columns (>= 1024px)
 */
export function useResponsiveColumns() {
  const [columns, setColumns] = useState(3); // Default to desktop

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setColumns(1); // Mobile
      } else if (width < 1024) {
        setColumns(2); // Tablet
      } else {
        setColumns(3); // Desktop
      }
    };

    // Set initial value
    updateColumns();

    // Update on resize
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  return columns;
}
