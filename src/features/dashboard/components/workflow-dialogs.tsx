import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type {
	TransactionDetails,
	WorkflowUser,
} from "@/features/dashboard/api/dashboard"
import {
	progressOptions,
	transactionDetailsOptions,
} from "@/features/dashboard/api/dashboard.queries"
import { formatAmount, formatCardNumber } from "@/lib/format"

/** A field of a waiting transaction, shown the way its type asks: amounts grouped, card numbers in fours, IBANs left to right. */
export function DetailValue({ value, type }: { value: string; type: string }) {
	const { i18n } = useTranslation()
	if (type === "Amount" && /^-?\d+$/.test(value))
		return <span>{formatAmount(Number(value), i18n.language)}</span>
	if (type === "CardPan")
		return <span dir="ltr">{formatCardNumber(value)}</span>
	if (type === "Iban" || type === "LeftAlign")
		return <span dir="ltr">{value}</span>
	return <span>{value}</span>
}

export function DetailList({ details }: { details: TransactionDetails }) {
	return (
		<div className="flex flex-col gap-3">
			<dl className="flex flex-col gap-2 text-sm">
				{details.fields.map((field, index) => (
					<div
						key={`${field.key}-${index}`}
						className="flex flex-wrap justify-between gap-2"
					>
						<dt className="text-muted-foreground">{field.label}</dt>
						<dd className="font-medium wrap-break-word">
							<DetailValue value={field.value} type={field.type} />
						</dd>
					</div>
				))}
			</dl>
			{details.batch ? (
				<div className="flex flex-col gap-2">
					{details.batch.title ? (
						<h3 className="text-sm font-semibold">{details.batch.title}</h3>
					) : null}
					<div className="max-h-64 overflow-auto rounded-md border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b">
									{details.batch.headers.map((header, index) => (
										<th
											key={index}
											className="text-muted-foreground p-2 text-start font-medium"
										>
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{details.batch.rows.map((row, rowIndex) => (
									<tr key={rowIndex} className="border-b last:border-0">
										{row.map((cell, index) => (
											<td key={index} className="p-2 tabular-nums">
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}
		</div>
	)
}

interface DetailsProps {
	workflowRunId: number
	serviceKey: string
	title: string
	onClose: () => void
}

/** What a waiting transaction would do. Mount it only while open. */
export function TransactionDetailsDialog({
	workflowRunId,
	serviceKey,
	title,
	onClose,
}: DetailsProps) {
	const { t } = useTranslation()
	const details = useQuery(transactionDetailsOptions(workflowRunId, serviceKey))
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{t("dashboard.details.hint")}</DialogDescription>
				</DialogHeader>
				{details.isPending ? (
					<Skeleton className="h-32 w-full" />
				) : details.isError ? (
					<p role="alert" className="text-destructive text-sm">
						{details.error.message || t("dashboard.details.error")}
					</p>
				) : (
					<DetailList details={details.data} />
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{t("dashboard.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function People({ label, users }: { label: string; users: WorkflowUser[] }) {
	const { t } = useTranslation()
	if (users.length === 0) return null
	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-sm font-semibold">{label}</h3>
			<ul className="flex flex-col gap-1 text-sm">
				{users.map((user, index) => (
					<li
						key={`${user.username}-${index}`}
						className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-2"
					>
						<span>
							{user.name}
							{user.isMaster ? (
								<span className="text-muted-foreground text-xs">
									{" "}
									({t("dashboard.progress.master")})
								</span>
							) : null}
						</span>
						<span className="text-muted-foreground">
							{user.state === 1
								? t("dashboard.progress.accepted")
								: user.state === 0
									? t("dashboard.progress.rejected")
									: user.state === 2
										? t("dashboard.progress.started")
										: t("dashboard.progress.waiting")}
							{user.date ? ` · ${user.date}` : ""}
						</span>
						{user.rejectReason ? (
							<span className="text-destructive basis-full">
								{user.rejectReason}
							</span>
						) : null}
					</li>
				))}
			</ul>
		</div>
	)
}

interface ProgressProps {
	workflowRunId: number
	title: string
	onClose: () => void
}

/** Who has to start, accept and sign an item and who already has. Mount it only while open. */
export function ProgressDialog({
	workflowRunId,
	title,
	onClose,
}: ProgressProps) {
	const { t } = useTranslation()
	const progress = useQuery(progressOptions(workflowRunId))
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{t("dashboard.progress.hint")}</DialogDescription>
				</DialogHeader>
				{progress.isPending ? (
					<Skeleton className="h-32 w-full" />
				) : progress.isError ? (
					<p role="alert" className="text-destructive text-sm">
						{progress.error.message || t("dashboard.progress.error")}
					</p>
				) : (
					<div className="flex flex-col gap-4">
						<People
							label={t("dashboard.progress.starters")}
							users={progress.data.initiators}
						/>
						{progress.data.levels.map((level) => (
							<People
								key={level.number}
								label={t("dashboard.progress.level", { number: level.number })}
								users={level.users}
							/>
						))}
						<People
							label={t("dashboard.progress.signatories")}
							users={progress.data.signatories}
						/>
					</div>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{t("dashboard.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
