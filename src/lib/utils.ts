import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional + Tailwind classes safely. Used by shadcn-svelte components. */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
