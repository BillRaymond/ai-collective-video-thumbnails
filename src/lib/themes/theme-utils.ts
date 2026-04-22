type TitleAccentParts = {
	prefix: string;
	accent: string;
};

type ImageFailureTrackerOptions<T> = {
	getFailures: () => Record<string, boolean>;
	setFailures: (next: Record<string, boolean>) => void;
	getKey: (item: T) => string;
};

type FitTitleFontSizeOptions = {
	box: HTMLElement | null;
	element: HTMLElement | null;
	cssVariableName: string;
	min: number;
	max: number;
	heightRatio?: number;
};

export function splitTitleAccent(title: string): TitleAccentParts {
	const match = title.match(/^(.*?[?:]\s+)(\S[\s\S]*)$/);

	if (!match) {
		return {
			prefix: title,
			accent: ''
		};
	}

	return {
		prefix: match[1],
		accent: match[2]
	};
}

export function hasImageUrl(value: string) {
	return value.trim().length > 0;
}

export function createImageFailureTracker<T>({
	getFailures,
	setFailures,
	getKey
}: ImageFailureTrackerOptions<T>) {
	return {
		isFailed(item: T) {
			return Boolean(getFailures()[getKey(item)]);
		},
		markFailed(item: T) {
			const key = getKey(item);
			setFailures({ ...getFailures(), [key]: true });
		},
		clearFailed(item: T) {
			const key = getKey(item);
			const failures = getFailures();

			if (!failures[key]) {
				return;
			}

			const { [key]: _, ...rest } = failures;
			setFailures(rest);
		}
	};
}

export function fitTitleFontSize({
	box,
	element,
	cssVariableName,
	min,
	max,
	heightRatio = 1
}: FitTitleFontSizeOptions) {
	if (!box || !element) {
		return;
	}

	const availableWidth = Math.floor(box.clientWidth);
	const availableHeight = Math.floor(box.clientHeight * heightRatio);

	if (availableWidth <= 0 || availableHeight <= 0) {
		return;
	}

	const applyTitleSize = (size: number) => {
		element.style.setProperty(cssVariableName, `${size}px`);
	};

	const titleFits = () => {
		const titleRect = element.getBoundingClientRect();
		const boxRect = box.getBoundingClientRect();
		const clippedHorizontally =
			Math.ceil(element.scrollWidth) > availableWidth + 1 || titleRect.right > boxRect.right + 1;
		const clippedVertically =
			Math.ceil(element.scrollHeight) > availableHeight + 1 ||
			titleRect.bottom > boxRect.top + availableHeight + 1;

		return !clippedHorizontally && !clippedVertically;
	};

	let low = min;
	let high = max;
	let best = min;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		applyTitleSize(mid);

		if (titleFits()) {
			best = mid;
			low = mid + 1;
			continue;
		}

		high = mid - 1;
	}

	applyTitleSize(best);

	while (best > min && !titleFits()) {
		best -= 1;
		applyTitleSize(best);
	}
}
