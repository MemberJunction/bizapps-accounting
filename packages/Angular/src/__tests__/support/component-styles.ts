import { type Type } from '@angular/core';

/**
 * The CSS a component actually ships, whitespace-collapsed.
 *
 * jsdom does no layout and resolves almost none of the cascade, so a DOM spec cannot ask what a
 * box would scroll. What it can do is read the rules the component carries, and `ɵcmp` is
 * Angular's own compiled definition -- so this reads the EMITTED css, scoped selectors and all,
 * rather than the source text of the decorator.
 */
export function ComponentCss(cmp: Type<unknown>): string {
    const def = (cmp as unknown as { ɵcmp?: { styles?: string[] } }).ɵcmp;
    return (def?.styles ?? []).join('\n').replace(/\s+/g, ' ');
}

/** The body of the first rule whose selector contains `selector`, e.g. `[_nghost` or `.mja-overview[`. */
export function RuleBody(css: string, selector: string): string {
    const at = css.indexOf(selector);
    if (at === -1) return '';
    const open = css.indexOf('{', at);
    const close = css.indexOf('}', open);
    return open === -1 || close === -1 ? '' : css.slice(open + 1, close);
}
