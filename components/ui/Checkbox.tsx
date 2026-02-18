import { Description, FieldError, Label } from '@/components/ui/Field';
import { compose, cva, cx } from '@/styles/cva';
import { focusRing } from '@/styles/ui/focusRing';
import { composeTailwindRenderProps } from '@/styles/util';
import { CheckIcon, MinusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
	CheckboxGroupProps as RACCheckboxGroupProps,
	CheckboxProps as RACCheckboxProps,
	ValidationResult as RACValidationResult
} from 'react-aria-components';
import { Checkbox as RACCheckbox, CheckboxGroup as RACCheckboxGroup, composeRenderProps } from 'react-aria-components';

export type CheckboxGroupProps = RACCheckboxGroupProps & {
	readonly description?: string;
	readonly errorMessage?: string | ((validation: RACValidationResult) => string);
	readonly label?: string;
};

export function CheckboxGroup(props: CheckboxGroupProps) {
	return (
		<RACCheckboxGroup
			{...props}
			className={composeTailwindRenderProps(props.className, 'flex flex-col gap-2')}
			isInvalid={Boolean(props.errorMessage)}
		>
			{values => (
				<>
					{props.label && <Label>{props.label}</Label>}
					{typeof props.children === 'function' ? props.children(values) : props.children}
					{props.description && <Description className="block">{props.description}</Description>}
					<FieldError>{props.errorMessage}</FieldError>
				</>
			)}
		</RACCheckboxGroup>
	);
}

const checkboxStyles = cva({
	base: 'group text-base-label-md flex place-items-center gap-2 transition',
	variants: {
		isDisabled: {
			true: 'opacity-38'
		}
	}
});

const boxStyles = compose(
	focusRing,
	cva({
		base: 'flex shrink-0 place-content-center place-items-center transition',
		variants: {
			variant: {
				unset: null,
				default: [
					'size-4 rounded-xs border-[1.5px] *:data-[slot=icon]:size-3.5',
					'bg-base-neutral-0 border-base-neutral-300 text-base-neutral-40 dark:bg-base-neutral-800 dark:border-base-neutral-300',
					'group-hover:border-base-neutral-200 dark:group-hover:border-base-neutral-600',
					'group-focus-visible:border-base-neutral-200 dark:group-focus-visible:border-base-neutral-600',
					'group-pressed:border-base-neutral-100 dark:group-pressed:border-base-neutral-700',
					'group-invalid:border-base-sunset-500',
					'group-invalid:group-hover:border-base-sunset-200 dark:group-invalid:group-hover:border-base-sunset-700',
					'group-invalid:group-focus-visible:border-base-sunset-200 dark:group-invalid:group-focus-visible:border-base-sunset-700',
					'group-invalid:group-pressed:border-base-sunset-100 dark:group-invalid:group-pressed:border-base-sunset-800'
				]
			},
			isSelected: {
				true: [
					'bg-base-neutral-700 dark:bg-base-neutral-100 dark:text-base-neutral-900 border-transparent dark:border-transparent',
					'group-hover:bg-base-neutral-500 dark:group-hover:bg-base-neutral-300 group-hover:border-transparent dark:group-hover:border-transparent',
					'group-focus-visible:bg-base-neutral-500 dark:group-focus-visible:bg-base-neutral-300 group-focus-visible:border-transparent dark:group-focus-visible:border-transparent',
					'group-pressed:bg-base-neutral-400 group-pressed:text-base-neutral-800 dark:group-pressed:text-base-neutral-900 dark:group-pressed:bg-base-neutral-400 dark:group-pressed:border-transparent group-pressed:border-transparent',
					'group-invalid:bg-base-sunset-500 group-invalid:text-base-neutral-900',
					'group-invalid:group-hover:bg-base-sunset-200 dark:group-invalid:group-hover:bg-base-sunset-700 dark:group-invalid:group-hover:text-base-neutral-40',
					'group-invalid:group-focus-visible:bg-base-sunset-200 dark:group-invalid:group-focus-visible:bg-base-sunset-700 dark:group-invalid:group-focus-visible:text-base-neutral-40',
					'group-invalid:group-pressed:bg-base-sunset-100 dark:group-invalid:group-pressed:bg-base-sunset-800 dark:group-invalid:group-pressed:text-base-neutral-40'
				]
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	})
);

export type CheckboxProps = RACCheckboxProps & {
	readonly classNames?: {
		readonly boxContainer?: string;
	};
	readonly description?: string;
	readonly label?: string;
};

export function Checkbox(props: CheckboxProps) {
	return (
		<RACCheckbox
			{...props}
			className={composeRenderProps(props.className, (className, renderProps) =>
				checkboxStyles({
					...renderProps,
					className
				})
			)}
		>
			{({ isSelected, isIndeterminate, ...renderProps }) => (
				<div
					className={cx(
						'flex gap-2',
						props.description ? 'place-items-start' : 'place-items-center',
						props.classNames?.boxContainer
					)}
				>
					<div className={boxStyles({ ...renderProps, isSelected: isSelected || isIndeterminate })}>
						{isIndeterminate ? (
							<MinusIcon aria-hidden data-slot="icon" size={18} strokeWidth={1.5} />
						) : isSelected ? (
							<CheckIcon aria-hidden data-slot="icon" size={18} strokeWidth={1.5} />
						) : null}
					</div>

					{props.label || props.children || props.description ? (
						<div className="flex flex-col place-items-start gap-1">
							{props.label ? (
								<Label className={cx('description' in props && 'text-base-label-md/4')}>{props.label}</Label>
							) : (
								(props.children as ReactNode)
							)}
							{props.description && <Description className="block">{props.description}</Description>}
						</div>
					) : null}
				</div>
			)}
		</RACCheckbox>
	);
}
