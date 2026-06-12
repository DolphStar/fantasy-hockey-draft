import type { Variants } from 'framer-motion';

/** Page content enter: fade + rise. Key the wrapper by top-level route segment. */
export const pageEnter: Variants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
};

/** Staggered list container + item (standings rows, card grids). */
export const staggerList: Variants = {
    animate: { transition: { staggerChildren: 0.04 } },
};
export const staggerItem: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};
