import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/web/utils/cn";

interface ResponseProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

/**
 * Response Component
 *
 * A lightweight wrapper for markdown content that provides:
 * 1. Base layout and responsiveness
 * 2. Overflow handling for tables and code
 * 3. Image responsiveness
 *
 * Delegates specific styling to:
 * - Prose classes (passed via className prop)
 * - CodeBlock component (for code elements)
 */
export function Response({ children, className, ...props }: ResponseProps) {
	return (
		<div
			className={cn(
				// Base markdown response container
				"markdown-response w-full min-w-0 break-words",
				// Pre/code overflow handling (CodeBlock handles detailed styling)
				"[&_pre]:max-w-full [&_pre]:overflow-x-auto",
				"[&_pre_code]:break-normal",
				// Table responsiveness
				"[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
				// Image responsiveness
				"[&_img]:h-auto [&_img]:max-w-full",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
