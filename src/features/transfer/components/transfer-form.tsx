import {CheckCircle2, UserRound, Wallet} from "lucide-react"
import type {ReactNode} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {formatAmount} from "@/lib/format"

// The pieces every transfer page is built from: numbered steps in cards, a sticky summary beside them,
// the holder shown once a lookup succeeds, and quick amounts. One look for account, card, IBAN and group transfers.

/** Round amounts, in Rials, offered under the amount field. */
export const QUICK_AMOUNTS = [10_000_000, 50_000_000, 100_000_000, 500_000_000] as const

interface TransferFormLayoutProps {
	title: string
	children: ReactNode
	/** The summary panel, shown beside the steps on large screens and after them on small ones. */
	aside: ReactNode
}

/** A title, the steps in a column and the summary beside them. */
export function TransferFormLayout({title, children, aside}: TransferFormLayoutProps) {
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{title}</h1>
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
				<span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-primary-soft text-sm text-primary">
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
				<span className="text-muted-foreground">{label}</span>
				<span className="truncate font-semibold">{name}</span>
			</span>
			<CheckCircle2 aria-hidden="true" className="ms-auto size-5 shrink-0 text-success" />
		</div>
	)
}

/** Round amounts to pick with one tap. */
export function QuickAmounts({amounts, value, onPick}: {amounts: readonly number[]; value: number; onPick: (amount: number) => void}) {
	const {i18n} = useTranslation()
	return (
		<div className="flex flex-wrap gap-2">
			{amounts.map((quick) => (
				<Button
					key={quick}
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={value === quick}
					className={value === quick ? "border-primary bg-primary-soft text-primary" : undefined}
					onClick={() => onPick(quick)}
				>
					{formatAmount(quick, i18n.language)}
				</Button>
			))}
		</div>
	)
}

interface TransferSummaryProps {
	id: string
	title: string
	/** The amount line, or null before one is typed. */
	amount: string | null
	rows: {label: string; value: string | null}[]
	reviewLabel: string
	onReview: () => void
}

/** The sticky panel that fills in as the steps are completed and holds the button that moves on. */
export function TransferSummary({id, title, amount, rows, reviewLabel, onReview}: TransferSummaryProps) {
	return (
		<aside aria-labelledby={id} className="lg:sticky lg:top-6 lg:self-start">
			<div className="overflow-hidden rounded-2xl border bg-card shadow-card">
				<div className="bg-brand-gradient p-5 text-white">
					<h2 id={id} className="flex items-center gap-2 text-sm">
						<Wallet aria-hidden="true" className="size-4" />
						{title}
					</h2>
					<p className="mt-2 text-2xl font-bold">{amount ?? "—"}</p>
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
					<Button type="button" size="lg" className="w-full" onClick={onReview}>
						{reviewLabel}
					</Button>
				</div>
			</div>
		</aside>
	)
}
