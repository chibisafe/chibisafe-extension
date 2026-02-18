import { cx } from '@/styles/cva';
import type { PropsWithChildren, ReactNode } from 'react';

export const Panel = ({
	children,
	className,
	title
}: PropsWithChildren<{ className?: string; title?: string | ReactNode }>) => {
	return (
		<div className="flex flex-col gap-2 w-full max-w-xl">
			{title && <h2 className="text-highlight font-normal text-sm pl-4">{title}</h2>}
			<div className="card">
				<div className={cx('p-4', className)}>{children}</div>
			</div>
		</div>
	);
};
