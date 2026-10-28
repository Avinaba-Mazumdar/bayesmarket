import { handleRovingKeydown } from './roving-focus';

describe('handleRovingKeydown', () => {
    let container: HTMLElement;
    let clicks: string[];

    beforeEach(() => {
        clicks = [];
        container = document.createElement('div');
        container.setAttribute('role', 'tablist');
        ['a', 'b', 'c'].forEach((id) => {
            const btn = document.createElement('button');
            btn.setAttribute('role', 'tab');
            btn.textContent = id;
            btn.addEventListener('click', () => clicks.push(id));
            container.appendChild(btn);
        });
        document.body.appendChild(container);
    });

    afterEach(() => container.remove());

    function press(key: string, from: number): KeyboardEvent {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        const buttons = container.querySelectorAll('button');
        buttons[from].dispatchEvent(event);
        return event;
    }

    function listen(): void {
        container.addEventListener('keydown', (e) => handleRovingKeydown(e, '[role="tab"]'));
    }

    it('moves to the next item and activates it on ArrowRight', () => {
        listen();
        press('ArrowRight', 0);
        expect(document.activeElement?.textContent).toBe('b');
        expect(clicks).toEqual(['b']);
    });

    it('wraps around at both ends', () => {
        listen();
        press('ArrowRight', 2);
        expect(document.activeElement?.textContent).toBe('a');
        press('ArrowLeft', 0);
        expect(document.activeElement?.textContent).toBe('c');
    });

    it('jumps to the first and last items with Home and End', () => {
        listen();
        press('End', 0);
        expect(document.activeElement?.textContent).toBe('c');
        press('Home', 2);
        expect(document.activeElement?.textContent).toBe('a');
    });

    it('ignores unrelated keys', () => {
        listen();
        const event = press('Enter', 0);
        expect(event.defaultPrevented).toBe(false);
        expect(clicks).toEqual([]);
    });
});
