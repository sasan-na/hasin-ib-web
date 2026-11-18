import {cn} from "@/lib/utils"

interface AmountProps {
	/** An amount already formatted with its unit, such as "12,500,000 Rials": the figure first, then the unit. */
	text: string
	className?: string
}

/**
 * The amount is the thing a money screen is about, so it is the largest and heaviest text on it, with the unit small beside it.
 * Text that does not look like "figure unit" is shown as it comes.
 */
export function Amount({text, className}: AmountProps) {
	const match = /^(\S+)\s+(.+)$/.exec(text.trim())
	if (!match) return <span className={cn("text-3xl font-semibold", className)}>{text}</span>
	return (
		<span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
			<span dir="ltr" className="text-3xl font-semibold">
				{match[1]}
			</span>
			<span className="text-sm text-muted-foreground">{match[2]}</span>
		</span>
	)
}
