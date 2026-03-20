/**
 * Returns the CSS classes that should be applied to the ToolButton
 * based on the `active` prop. Extracted here so it can be unit-tested
 * independently of the Vue component template.
 */
export function getToolButtonClass(active: boolean): string {
  return active
    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50";
}
