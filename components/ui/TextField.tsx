import { Button } from '@/components/ui/button';
import { Description, FieldError, FieldGroup, Input, Label } from '@/components/ui/Field';
import { cx } from '@/styles/cva';
import { composeTailwindRenderProps } from '@/styles/util';
import { EyeIcon, EyeOffIcon, XCircleIcon } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useState } from 'react';
import type {
	TextFieldProps as RACTextFieldProps,
	ValidationResult as RACValidationResult
} from 'react-aria-components';
import { TextField as RACTextField } from 'react-aria-components';

export type TextFieldProps = RACTextFieldProps & {
	readonly description?: string;
	readonly errorMessage?: string | ((validation: RACValidationResult) => string) | undefined;
	readonly isClearable?: boolean;
	readonly isDisabled?: boolean;
	readonly isRevealable?: boolean;
	readonly label?: ReactNode | string;
	readonly placeholder?: string;
	readonly prefix?: ReactNode | string;
	readonly suffix?: ReactNode | string;
	readonly inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> & {
		'data-1p-ignore'?: boolean;
	};
};

export function TextField(props: TextFieldProps) {
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const inputType = props.isRevealable ? (isPasswordVisible ? 'text' : 'password') : (props.type ?? 'text');

	return (
		<RACTextField
			{...props}
			className={composeTailwindRenderProps(props.className, 'group flex w-full flex-col gap-1')}
			isInvalid={Boolean(props.errorMessage)}
			type={inputType}
		>
			{props.children ?? (
				<>
					{props.label && <Label>{props.label}</Label>}
					<FieldGroup isDisabled={props.isDisabled!} isInvalid={Boolean(props.errorMessage)}>
						{props.prefix && typeof props.prefix === 'string' ? (
							<span className="ml-3">{props.prefix}</span>
						) : (
							props.prefix
						)}
						<Input placeholder={props.placeholder} />
						{props.isClearable && props.value && !props.isDisabled && !props.isReadOnly && (
							<Button
								className="rounded-full"
								excludeFromTabOrder
								onPress={() => props.onChange?.('')}
								preventFocusOnPress
								size="icon"
								variant="unset"
							>
								<XCircleIcon aria-hidden className="animate-in size-6 shrink-0 stroke-[1.5]" />
							</Button>
						)}
						{props.isRevealable ? (
							<Button
								className={cx(
									'rounded-full',
									props.isClearable && props.value && !props.isDisabled && !props.isReadOnly && 'ml-2'
								)}
								excludeFromTabOrder
								onPress={() => setIsPasswordVisible(!isPasswordVisible)}
								preventFocusOnPress
								size="icon"
								variant="unset"
							>
								{isPasswordVisible ? (
									<EyeOffIcon aria-hidden className="size-6 shrink-0 stroke-[1.5]" />
								) : (
									<EyeIcon aria-hidden className="size-6 shrink-0 stroke-[1.5]" />
								)}
							</Button>
						) : props.suffix && typeof props.suffix === 'string' ? (
							<span className="mr-2">{props.suffix}</span>
						) : (
							props.suffix
						)}
					</FieldGroup>
					{props.description && <Description>{props.description}</Description>}
					<FieldError>{props.errorMessage}</FieldError>
				</>
			)}
		</RACTextField>
	);
}
