import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PayInstallmentDialog } from "@/features/loan/components/pay-installment-dialog"
import { PayInstallmentCardDialog } from "@/features/loan/components/pay-installment-card-dialog"
import { UnfollowDialog } from "@/features/loan/components/unfollow-dialog"
import type { Loan } from "@/features/loan/api/loan"
import { loansOptions } from "@/features/loan/api/loan.queries"
import { formatAmount, formatCardNumber } from "@/lib/format"

/** The user's loans (and those they follow for others): what is due, what is left, and what is overdue. */
export default function LoanListPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const loans = useQuery(loansOptions(language))
	const [paying, setPaying] = React.useState<Loan | null>(null)
	const [payingByCard, setPayingByCard] = React.useState<Loan | null>(null)
	const [unfollowing, setUnfollowing] = React.useState<Loan | null>(null)

	const money = (value: number): string =>
		`${formatAmount(value, language)} ${t("loan.rial")}`
	const row = (label: string, value: string | null, ltr = false) =>
		value ? (
			<div className="flex flex-wrap justify-between gap-2 text-sm">
				<dt className="text-muted-foreground">{label}</dt>
				<dd dir={ltr ? "ltr" : undefined} className="font-medium">
					{value}
				</dd>
			</div>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("loan.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.loanInterest.path}>
							{t("loan.interest.open")}
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.loanBatch.path}>{t("loan.batch.open")}</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.loanOther.path}>{t("loan.other.open")}</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.loanJunior.path}>{t("loan.junior.open")}</Link>
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={loans.isFetching}
						onClick={() => void loans.refetch()}
					>
						<RefreshCw
							aria-hidden="true"
							className={loans.isFetching ? "animate-spin" : undefined}
						/>
						{t("loan.refresh")}
					</Button>
				</div>
			</div>

			{loans.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
			) : loans.isError ? (
				<p
					role="alert"
					className="bg-card text-destructive rounded-lg border p-5 text-sm"
				>
					{loans.error.message || t("loan.error")}
				</p>
			) : loans.data.length === 0 ? (
				<p className="bg-card text-muted-foreground rounded-lg border p-5 text-sm">
					{t("loan.empty")}
				</p>
			) : (
				<ul className="grid gap-4 md:grid-cols-2">
					{loans.data.map((loan, index) => (
						<li
							key={`${loan.accountNumber}-${loan.cardNumber}-${index}`}
							className="bg-card flex flex-col gap-3 rounded-lg border p-5"
						>
							<div className="flex flex-col gap-1">
								<h2 className="text-base font-semibold">
									{loan.title || t("loan.fallbackTitle")}
								</h2>
								{loan.typeName ? (
									<p className="text-muted-foreground text-sm">
										{loan.typeName}
									</p>
								) : null}
								{loan.isOther ? (
									<p className="text-muted-foreground text-xs">
										{t("loan.followed")}
									</p>
								) : null}
							</div>
							{loan.error ? (
								<p role="alert" className="text-destructive text-sm">
									{loan.error}
								</p>
							) : (
								<dl className="flex flex-col gap-2">
									{row(t("loan.account"), loan.accountNumber || null, true)}
									{row(
										t("loan.card"),
										loan.cardNumber ? formatCardNumber(loan.cardNumber) : null,
										true,
									)}
									{row(t("loan.holder"), loan.holder || null)}
									{row(t("loan.nextDue"), loan.nextDueDate || null, true)}
									{row(
										t("loan.installment"),
										loan.installment !== null ? money(loan.installment) : null,
									)}
									{row(
										t("loan.remaining"),
										loan.remaining !== null ? money(loan.remaining) : null,
									)}
									{row(
										t("loan.overdue"),
										loan.overdue ? money(loan.overdue) : null,
									)}
									{row(
										t("loan.penalty"),
										loan.penalty ? money(loan.penalty) : null,
									)}
									{row(
										t("loan.progress"),
										loan.totalCount !== null && loan.paidCount !== null
											? t("loan.progressValue", {
													paid: loan.paidCount,
													total: loan.totalCount,
												})
											: null,
									)}
									{row(t("loan.firstDate"), loan.firstDate || null, true)}
								</dl>
							)}
							{!loan.error && loan.payable ? (
								<Button
									type="button"
									size="sm"
									className="self-start"
									onClick={() => setPaying(loan)}
								>
									{t("loan.pay.action")}
								</Button>
							) : null}
							{!loan.error && loan.payable ? (
								<Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setPayingByCard(loan)}>
									{t("loan.pay.cardAction")}
								</Button>
							) : null}
							{loan.isOther ? (
								<Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setUnfollowing(loan)}>
									{t("loan.other.unfollow")}
								</Button>
							) : null}
						</li>
					))}
				</ul>
			)}
			{paying ? (
				<PayInstallmentDialog loan={paying} onClose={() => setPaying(null)} />
			) : null}
			{payingByCard ? <PayInstallmentCardDialog loan={payingByCard} onClose={() => setPayingByCard(null)} /> : null}
			{unfollowing ? <UnfollowDialog loan={unfollowing} onClose={() => setUnfollowing(null)} /> : null}
		</div>
	)
}
