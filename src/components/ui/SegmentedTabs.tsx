import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

const containerCls = 'inline-flex gap-1 bg-slate-900/70 border border-slate-800 rounded-xl p-1';
const itemCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors';
const activeCls = 'text-white bg-gradient-to-r from-blue-600 to-blue-500 shadow-[0_2px_12px_rgba(59,130,246,0.35)]';
const idleCls = 'text-slate-400 hover:text-slate-200';

interface SegmentedTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Button-based segmented control for in-page tabs (no routing). */
export function SegmentedTabs<T extends string>({ tabs, active, onChange, className }: SegmentedTabsProps<T>) {
  return (
    <div className={cn(containerCls, className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(itemCls, active === t.id ? activeCls : idleCls)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface SegmentedLinksProps {
  links: { to: string; label: string; end?: boolean }[];
  className?: string;
}

/** NavLink-based segmented control for route-backed tabs (Players hub). */
export function SegmentedLinks({ links, className }: SegmentedLinksProps) {
  return (
    <div className={cn(containerCls, className)}>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => cn(itemCls, isActive ? activeCls : idleCls)}
        >
          {l.label}
        </NavLink>
      ))}
    </div>
  );
}
