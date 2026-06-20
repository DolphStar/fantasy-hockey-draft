/**
 * Shared atmospheric background for the standalone (pre-league) pages —
 * soft brand-coloured blooms over the app's base gradient. Fixed + behind content.
 */
export function GlowBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-blue-600/20 blur-[130px]" />
      <div className="absolute -bottom-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="absolute top-1/3 -left-32 w-[24rem] h-[24rem] rounded-full bg-indigo-700/10 blur-[120px]" />
    </div>
  );
}
