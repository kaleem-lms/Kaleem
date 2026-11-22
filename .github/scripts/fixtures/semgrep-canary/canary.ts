// A known-bad line the CI canary must always flag (see canary.py).
export function show(el: HTMLElement, html: string): void {
	el.innerHTML = html;
}
