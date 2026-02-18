import { cva } from 'cva';

export const focusRing = cva({
	base: 'outline-blue-400 dark:outline-blue-600 outline-offset-2 forced-colors:outline-[Highlight]',
	variants: {
		isFocusVisible: {
			true: 'outline-2',
			false: 'outline-0'
		}
	}
});
