import {Check} from "lucide-react"
import type {ReactNode} from "react"

import {SlideRow} from "@/features/transfer/components/slide-row"
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

/** Choices (accounts, cards) as cards in one row that slides when they do not fit. A radio group underneath, so the keyboard and screen readers work. */
export function ChoiceCards({choices, value, onChange, labelledBy, name}: ChoiceCardsProps) {
	return (
		<SlideRow role="radiogroup" aria-labelledby={labelledBy} className="gap-3">
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
		</SlideRow>
	)
}
