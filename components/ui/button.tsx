import { buttonStyles } from '@/styles/ui/button';
import type { VariantProps } from 'cva';
import type { ButtonProps as RACButtonProps } from 'react-aria-components';
import { Button as RACButton, composeRenderProps } from 'react-aria-components';

export type ButtonProps = RACButtonProps & VariantProps<typeof buttonStyles>;

export function Button(props: ButtonProps) {
	return (
		<RACButton
			{...props}
			className={composeRenderProps(props.className, (className, renderProps) =>
				buttonStyles({
					...renderProps,
					variant: props.variant,
					size: props.size,
					isDestructive: props.isDestructive,
					isDark: props.isDark,
					className
				})
			)}
		>
			{values => <>{typeof props.children === 'function' ? props.children(values) : props.children}</>}
		</RACButton>
	);
}
