import type {ReactNode} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog"

export interface SummaryRow {
	label: string
	value: ReactNode
}

interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	/** What is about to happen, as label/value pairs the user can check before saying yes. */
	summary: SummaryRow[]
	/** The password step, when the service needs one. */
	children?: ReactNode
	confirmLabel: string
	pendingLabel: string
	/** False until everything the service needs (for example the password) is in. */
	canConfirm: boolean
	pending: boolean
	/** The bank's refusal or a network problem from the last try; the dialog stays open so the user can fix it. */
	error?: string | null
	onConfirm: () => void
}

/**
 * The last step before something is sent to the bank. It shows what will happen, asks for the password, and
 * cannot be dismissed or confirmed twice while a request is in flight, so one click is one transaction.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	summary,
	children,
	confirmLabel,
	pendingLabel,
	canConfirm,
	pending,
	error,
	onConfirm,
}: ConfirmDialogProps) {
	const {t} = useTranslation()

	return (
		<AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<dl className="flex flex-col gap-2 rounded-md border bg-muted/40 p-4 text-sm">
					{summary.map((row) => (
						<div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd className="font-medium wrap-break-word">{row.value}</dd>
						</div>
					))}
				</dl>
				{children}
				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
				<AlertDialogFooter>
					<Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
						{t("transaction.cancel")}
					</Button>
					<Button type="button" disabled={!canConfirm || pending} onClick={onConfirm}>
						{pending ? pendingLabel : confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
