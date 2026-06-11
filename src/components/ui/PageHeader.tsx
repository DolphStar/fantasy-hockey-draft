import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  /** Right side: SegmentedTabs/SegmentedLinks or actions */
  actions?: React.ReactNode;
  className?: string;
}

/** Standard page heading row: 30px/800 title left, actions right. */
export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 mb-5', className)}>
      <h1 className="text-3xl font-extrabold text-white">{title}</h1>
      {actions}
    </div>
  );
}
