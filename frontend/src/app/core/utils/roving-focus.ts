/**
 * Arrow-key navigation for composite widgets (WAI-ARIA APG tabs and radio groups).
 *
 * Moves focus between the items matched by `itemSelector` inside the element the listener is
 * attached to, wrapping at the ends, and activates the newly focused item (automatic activation,
 * as in the APG pattern). Pair with a roving tabindex so only the selected item is in the tab order.
 */
export function handleRovingKeydown(event: KeyboardEvent, itemSelector: string): void {
    const container = event.currentTarget as HTMLElement | null;
    const target = event.target as Node | null;
    if (!container || !target) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector)).filter((el) => !(el as HTMLButtonElement).disabled);
    if (items.length === 0) return;

    const current = items.findIndex((el) => el === target || el.contains(target));
    let next: number;
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            next = current < 0 ? 0 : (current + 1) % items.length;
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
            break;
        case 'Home':
            next = 0;
            break;
        case 'End':
            next = items.length - 1;
            break;
        default:
            return;
    }

    event.preventDefault();
    const item = items[next];
    item.focus();
    item.click();
}
