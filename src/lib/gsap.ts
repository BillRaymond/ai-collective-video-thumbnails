import { gsap } from 'gsap';

// Retained intentionally so future motion work can import through a single SSR-safe wrapper.
export { gsap };

export function motionAllowed() {
	return typeof window !== 'undefined'
		? !window.matchMedia('(prefers-reduced-motion: reduce)').matches
		: false;
}

export function withGsapContext(scope: Element, setup: (instance: typeof gsap) => void) {
	if (typeof window === 'undefined' || !motionAllowed()) {
		return () => {};
	}

	const context = gsap.context(() => {
		setup(gsap);
	}, scope);

	return () => context.revert();
}
