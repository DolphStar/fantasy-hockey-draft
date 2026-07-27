import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible label rendered above the control. Omit only when a label sits elsewhere. */
  label?: string;
  /** `flat` for toolbars and filter rows, `field` for form layouts. */
  tone?: 'flat' | 'field';
  className?: string;
  /** Applied to the wrapping element, not the control. */
  wrapperClassName?: string;
}

/**
 * The app's only dropdown. Wraps a real `<select>` so keyboard, screen readers
 * and mobile pickers all keep working — `appearance-none` plus our own chevron
 * is what stops the OS from drawing its own control inside the interface.
 *
 * The option list itself is still OS-rendered; that's the trade for not
 * reimplementing a listbox. Colour the options so the popup isn't white.
 */
export function Select({ label, tone = 'field', className, wrapperClassName, id, ...props }: SelectProps) {
  const autoId = `select-${label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'field'}`;
  const selectId = id ?? autoId;

  const tones = {
    flat: 'bg-ice-deep/70 border-ice-seam hover:border-paint/35',
    field: 'bg-ice-deep border-ice-seam hover:border-paint/35',
  };

  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', wrapperClassName)}>
      {label && (
        <label
          htmlFor={selectId}
          className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"
        >
          {label}
        </label>
      )}
      <div className="relative min-w-0">
        <select
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-lg border px-3 py-2.5 pr-9',
            'text-sm font-semibold text-slate-100 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-paint focus-visible:ring-offset-2 focus-visible:ring-offset-ice-boards',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&>option]:bg-ice-deep [&>option]:text-slate-100',
            tones[tone],
            className,
          )}
          {...props}
        />
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        />
      </div>
    </div>
  );
}
