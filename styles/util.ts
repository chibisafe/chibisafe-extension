import { cx } from '@/styles/cva';
import { composeRenderProps } from 'react-aria-components';

export function composeTailwindRenderProps<Type>(
	className: string | ((v: Type) => string) | undefined,
	tw: string
): string | ((v: Type) => string) {
	return composeRenderProps(className, className => cx(tw, className));
}
