/**
 * The logical size of a display: what the content thinks its width and height are. For a TV
 * turned on its side, the page is rendered at height x width and rotated with CSS, so the
 * components ask here instead of window.innerWidth. Set by DisplayPage before it renders roles.
 */
let size = { w: typeof window !== "undefined" ? window.innerWidth : 1920, h: typeof window !== "undefined" ? window.innerHeight : 1080 };
export function setLogicalSize(w: number, h: number): void { size = { w, h }; }
export function logical(): { w: number; h: number } { return size; }
export function isPortrait(): boolean { return size.h > size.w; }
/** The panel's long edge in px: the number px-based sizes scale from, the same in portrait and landscape. */
export function longSide(): number { return Math.max(size.w, size.h); }
