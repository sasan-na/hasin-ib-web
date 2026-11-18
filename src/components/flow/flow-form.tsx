import {CheckCircle2, ChevronRight, UserRound, Wallet} from "lucide-react"
import type {ReactNode} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {SlideRow} from "@/components/flow/slide-row"
import {formatAmount} from "@/lib/format"

// The pieces every money form is built from (transfers, bills, installments, top-ups): numbered steps in cards, a live summary (beside the steps on large
// screens, a bar at the bottom on small ones), saved payees to pick, the holder shown once a lookup succeeds, and
// quick amounts. One look for account, card, IBAN, group and standing order transfers.

/** The amount field: the largest text in the form, without shouting. */
export const AMOUNT_INPUT_CLASS = "h-14 text-xl font-semibold tabular md:text-xl"

/** Increments offered under the amount field, in Toman (the amount itself is in Rials). */
const QUICK_TOMAN = [500_000, 1_000_000, 5_000_000] as const
const RIALS_PER_TOMAN = 10
const MAX_AMOUNT = 999_999_999_999_999

interface FlowLayoutProps {
	/** Left out when the page around the form already has its heading. */
	title?: string
	children: ReactNode
	/** The summary panel: a card beside the steps on large screens, a bar at the bottom on small ones. */
	aside: ReactNode
}

/** A title, the steps in a column and the summary beside them. */
export function FlowLayout({title, children, aside}: FlowLayoutProps) {
	return (
		// The bottom padding keeps the last step clear of the summary bar on small screens.
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-28 lg:pb-0">
			{title ? <h1 className="text-2xl font-bold">{title}</h1> : null}
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="flex flex-col gap-5">{children}</div>
				{aside}
			</div>
		</div>
	)
}

interface StepSectionProps {
	id: string
	step: number
	title: string
	children: ReactNode
}

/** One numbered step: "1  From", "2  To", "3  Details". */
export function StepSection({id, step, title, children}: StepSectionProps) {
	const {i18n} = useTranslation()
	return (
		<section aria-labelledby={id} className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-card">
			<h2 id={id} className="flex items-center gap-3 text-base font-semibold">
				<span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-primary-soft text-sm text-primary-soft-foreground">
					{formatAmount(step, i18n.language)}
				</span>
				{title}
			</h2>
			{children}
		</section>
	)
}

/** A message under a field. */
export function FieldError({id, children}: {id?: string; children: ReactNode}) {
	return (
		<p id={id} role="alert" className="text-sm text-destructive">
			{children}
		</p>
	)
}

/** Who owns the destination, once the lookup found out. */
export function HolderCard({label, name}: {label: string; name: string}) {
	return (
		<div role="status" className="flex items-center gap-3 rounded-xl bg-success-soft p-3">
			<span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-success">
				<UserRound aria-hidden="true" className="size-5" />
			</span>
			<span className="flex min-w-0 flex-col text-sm">
				<span className="text-success-soft-foreground/80">{label}</span>
				<span className="truncate font-semibold text-success-soft-foreground">{name}</span>
			</span>
			<CheckCircle2 aria-hidden="true" className="ms-auto size-5 shrink-0 text-success" />
		</div>
	)
}

interface QuickAmountsProps {
	/** The amount now typed, in Rials. */
	value: number
	/** Gets the new amount, in Rials. */
	onPick: (amount: number) => void
	/** What the paying account holds, in Rials; adds a "whole balance" chip. Leave out when it is not known. */
	balance?: number | null
}

/** Chips that add to the amount (500,000 Toman and so on), and one that takes the whole balance. */
export function QuickAmounts({value, onPick, balance = null}: QuickAmountsProps) {
	const {t, i18n} = useTranslation()
	return (
		<div className="flex flex-wrap gap-2">
			{QUICK_TOMAN.map((toman) => (
				<Button
					key={toman}
					type="button"
					variant="outline"
					size="sm"
					aria-label={t("flow.quick.add", {amount: formatAmount(toman, i18n.language)})}
					onClick={() => onPick(Math.min(value + toman * RIALS_PER_TOMAN, MAX_AMOUNT))}
				>
					+{formatAmount(toman, i18n.language)}
				</Button>
			))}
			{balance !== null && balance > 0 ? (
				<Button type="button" variant="outline" size="sm" aria-pressed={value === balance} className={value === balance ? "border-primary bg-primary-soft text-primary-soft-foreground" : undefined} onClick={() => onPick(balance)}>
					{t("flow.quick.all")}
				</Button>
			) : null}
		</div>
	)
}

export interface Payee {
	key: string
	/** The name shown on the pill. */
	name: string
	/** What a tap fills in. */
	number: string
}

interface PayeeChipsProps {
	payees: Payee[]
	/** Gets the number to fill in. */
	onPick: (number: string) => void
}

/** Saved payees as one-tap pills in a single row; the row slides when they do not fit. Nothing is drawn when there are none. */
export function PayeeChips({payees, onPick}: PayeeChipsProps) {
	const {t} = useTranslation()
	if (payees.length === 0) return null

	return (
		<SlideRow role="group" aria-label={t("flow.payees")} className="gap-2">
			{payees.map((payee) => (
				<button
					key={payee.key}
					type="button"
					title={payee.number}
					onClick={() => onPick(payee.number)}
					className="min-h-9 shrink-0 snap-start rounded-full border bg-card px-4 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
				>
					{payee.name}
					<span className="sr-only"> {payee.number}</span>
				</button>
			))}
		</SlideRow>
	)
}

interface FlowSummaryProps {
	id: string
	title: string
	/** The amount line, or null before one is typed. */
	amount: string | null
	rows: {label: string; value: string | null}[]
	reviewLabel: string
	onReview: () => void
}

/** The forward button: a chevron that points the way the page reads and nudges that way on hover. */
function ReviewButton({label, onClick, className}: {label: string; onClick: () => void; className?: string}) {
	return (
		<Button type="button" size="lg" className={`group ${className ?? ""}`} onClick={onClick}>
			{label}
			<ChevronRight aria-hidden="true" className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
		</Button>
	)
}

/**
 * The live summary and the one button that moves on. A card beside the steps on large screens; on small screens
 * a bar fixed to the bottom with the amount and the button.
 */
export function FlowSummary({id, title, amount, rows, reviewLabel, onReview}: FlowSummaryProps) {
	return (
		<>
			<aside aria-labelledby={id} className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
				<div className="overflow-hidden rounded-2xl border bg-card shadow-card">
					<div className="bg-brand-gradient p-5 text-on-brand">
						<h2 id={id} className="flex items-center gap-2 text-sm">
							<Wallet aria-hidden="true" className="size-4" />
							{title}
						</h2>
						<p className="tabular mt-2 text-2xl font-bold">{amount ?? "—"}</p>
					</div>
					<dl className="divide-y px-5 text-sm">
						{rows.map((row) => (
							<div key={row.label} className="flex items-center justify-between gap-4 py-3">
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd className="truncate text-end font-medium">{row.value ?? "—"}</dd>
							</div>
						))}
					</dl>
					<div className="p-5 pt-3">
						<ReviewButton label={reviewLabel} onClick={onReview} className="w-full" />
					</div>
				</div>
			</aside>
			<div role="region" aria-label={title} className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card p-3 shadow-card lg:hidden">
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="text-xs text-muted-foreground">{title}</span>
					<span className="tabular truncate text-lg font-bold">{amount ?? "—"}</span>
				</div>
				<ReviewButton label={reviewLabel} onClick={onReview} />
			</div>
		</>
	)
}
