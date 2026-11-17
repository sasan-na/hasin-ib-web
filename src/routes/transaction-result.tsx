import {CircleAlert, CircleCheck, Clock} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useLocation} from "react-router-dom"

import {Button} from "@/components/ui/button"
import type {TransactionResult} from "@/lib/api/transaction"
import {cn} from "@/lib/utils"
import {routeMap} from "@/routing.tsx"

/** What a flow hands to this page through the router: the outcome, and where "do it again" should go. */
export interface TransactionResultState {
	result: TransactionResult
	again?: {to: string; label: string}
}

/** The outcome of a transaction. The result lives in router state only, so a reload has nothing to show. */
export default function TransactionResultPage() {
	const {t} = useTranslation()
	const state = useLocation().state as TransactionResultState | null

	if (!state?.result) return <Navigate to={routeMap.accountList.path} replace />
	const {result, again} = state

	const tone = result.ok ? (result.needsApproval ? "pending" : "success") : "failure"
	const Icon = tone === "success" ? CircleCheck : tone === "pending" ? Clock : CircleAlert
	const title =
		tone === "success" ? t("transaction.result.success") : tone === "pending" ? t("transaction.result.pending") : t("transaction.result.failure")

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-lg border bg-card p-6 md:p-8">
			<div className="flex items-start gap-3">
				<Icon
					aria-hidden="true"
					className={cn("mt-1 size-7 shrink-0", tone === "success" && "text-success", tone === "pending" && "text-warning", tone === "failure" && "text-destructive")}
				/>
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">{title}</h1>
					{result.message ? <p className="text-sm wrap-break-word text-muted-foreground">{result.message}</p> : null}
				</div>
			</div>

			<dl className="flex flex-col gap-2 text-sm">
				{result.type ? (
					<div className="flex flex-wrap gap-x-3">
						<dt className="w-32 shrink-0 text-muted-foreground">{t("transaction.result.type")}</dt>
						<dd>{result.type}</dd>
					</div>
				) : null}
				{result.transactionId !== null ? (
					<div className="flex flex-wrap gap-x-3">
						<dt className="w-32 shrink-0 text-muted-foreground">{t("transaction.result.reference")}</dt>
						<dd dir="ltr" className="tabular-nums">
							{result.transactionId}
						</dd>
					</div>
				) : null}
				{result.errorCode && !result.ok ? (
					<div className="flex flex-wrap gap-x-3">
						<dt className="w-32 shrink-0 text-muted-foreground">{t("transaction.result.errorCode")}</dt>
						<dd dir="ltr" className="tabular-nums">
							{result.errorCode}
						</dd>
					</div>
				) : null}
			</dl>

			{tone === "pending" ? <p className="text-sm text-muted-foreground">{t("transaction.result.pendingNote")}</p> : null}

			<div className="flex flex-wrap gap-2">
				<Button asChild>
					<Link to={routeMap.accountList.path}>{t("transaction.result.toAccounts")}</Link>
				</Button>
				{again ? (
					<Button asChild variant="outline">
						<Link to={again.to}>{again.label}</Link>
					</Button>
				) : null}
			</div>
		</div>
	)
}
