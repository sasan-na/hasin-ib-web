import {Check, ChevronLeft, ChevronRight} from "lucide-react"
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {cn} from "@/lib/utils"

export interface Choice {
	id: number
	title: string
	/** A number, shown left to right. */
	number: string
	/** The line under the number: a balance, or why the choice is unavailable. */
	note?: ReactNode
	disabled?: boolean
}

interface ChoiceCardsProps {
	choices: Choice[]
	value: number | null
	onChange: (id: number) => void
	/** Id of the element that names the group. */
	labelledBy: string
	name: string
}

/**
 * Choices (accounts, cards) as cards in one row. When they do not fit, the row slides: swipe or scroll it, or use the arrows.
 * A radio group underneath, so the keyboard and screen readers work.
 */
export function ChoiceCards({choices, value, onChange, labelledBy, name}: ChoiceCardsProps) {
	const {t} = useTranslation()
	const track = useRef<HTMLDivElement>(null)
	const [overflowing, setOverflowing] = useState(false)

	// Arrows only appear when there is something to slide to.
	useEffect(() => {
		const element = track.current
		if (!element) return
		const measure = (): void => setOverflowing(element.scrollWidth > element.clientWidth + 1)
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => observer.disconnect()
	}, [choices.length])

	const slide = useCallback((direction: 1 | -1) => {
		const element = track.current
		if (!element) return
		// Scrolling goes the other way in a right-to-left page.
		const sign = getComputedStyle(element).direction === "rtl" ? -1 : 1
		element.scrollBy({left: direction * sign * element.clientWidth * 0.8, behavior: "smooth"})
	}, [])

	return (
		<div className="relative">
			<div
				ref={track}
				role="radiogroup"
				aria-labelledby={labelledBy}
				className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{choices.map((choice) => {
					const selected = value === choice.id
					return (
						<label
							key={choice.id}
							className={cn(
								"relative flex w-56 shrink-0 cursor-pointer snap-start flex-col gap-1 rounded-xl border bg-card p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
								selected ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "hover:border-foreground/40",
								choice.disabled && "cursor-not-allowed opacity-60 hover:border-border",
							)}
						>
							<input type="radio" name={name} className="sr-only" checked={selected} disabled={choice.disabled} onChange={() => onChange(choice.id)} />
							{selected ? <Check aria-hidden="true" className="absolute end-3 top-3 size-4 text-primary" /> : null}
							<span className="line-clamp-2 pe-6 text-sm font-medium">{choice.title}</span>
							<span dir="ltr" className="text-start text-xs text-muted-foreground">
								{choice.number}
							</span>
							{choice.note ? <span className="mt-2 text-sm">{choice.note}</span> : null}
						</label>
					)
				})}
			</div>
			{overflowing ? (
				<div className="mt-2 flex justify-end gap-2">
					<Button type="button" variant="outline" size="icon-sm" aria-label={t("transfer.slidePrevious")} onClick={() => slide(-1)}>
						<ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
					</Button>
					<Button type="button" variant="outline" size="icon-sm" aria-label={t("transfer.slideNext")} onClick={() => slide(1)}>
						<ChevronRight aria-hidden="true" className="rtl:rotate-180" />
					</Button>
				</div>
			) : null}
		</div>
	)
}
