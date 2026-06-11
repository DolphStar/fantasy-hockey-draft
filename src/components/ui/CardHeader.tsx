import { cn } from '../../lib/utils';

interface CardHeaderProps {
  /** Emoji or icon node shown before the title */
  icon?: React.ReactNode;
  title: string;
  /** Right-side action, e.g. a link — rendered as-is */
  action?: React.ReactNode;
  className?: string;
}

/** Standard card header row: title left, optional action right, hairline bottom border. */
export function CardHeader({ icon, title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-b border-slate-800', className)}>
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {icon && <span aria-hidden>{icon}</span>}
        {title}
      </h3>
      {action}
    </div>
  );
}
