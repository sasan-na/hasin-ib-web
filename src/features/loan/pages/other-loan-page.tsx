import { OtherLoanTabs } from "@/features/loan/components/other-loan-tabs"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { StepSection } from "@/components/flow/flow-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isLoanNumber, lookupLoan } from "@/features/loan/api/other-loan"
import { PayInstallmentCardDialog } from "@/features/loan/components/pay-installment-card-dialog"
import { PayInstallmentDialog } from "@/features/loan/components/pay-installment-dialog"
import { formatAmount, formatCardNumber } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

/** Pay an installment of someone else's loan (or your own) by its account or card number, and optionally follow it. */
export default function OtherLoanPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const [number, setNumber] = useState("")
	const [error, setError] = useState("")
	const [paying, setPaying] = useState(false)
	const [payingByCard, setPayingByCard] = useState(false)
	const lookup = useMutation({ mutationFn: lookupLoan })
	const loan = lookup.data
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
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

	const submit = (): void => {
		if (!isLoanNumber(number)) return setError(t("loan.other.error.number"))
		setError("")
		lookup.mutate(number)
	}

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("loan.other.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.loan.path}>
						<BackIcon aria-hidden="true" />
						{t("loan.interest.back")}
					</Link>
				</Button>
			</div>
			<OtherLoanTabs />
			<p className="text-muted-foreground text-sm">{t("loan.other.hint")}</p>

			<form
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<StepSection
					id="other-loan-step"
					step={1}
					title={t("loan.other.number")}
				>
					<Label htmlFor="other-loan-number" className="sr-only">
						{t("loan.other.number")}
					</Label>
					<div className="flex flex-wrap gap-2">
						<Input
							id="other-loan-number"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={22}
							className="h-11 max-w-sm text-base"
							value={number}
							onChange={(event) => {
								setNumber(
									normalizeDigits(event.target.value).replace(/\D/g, ""),
								)
								lookup.reset()
							}}
						/>
						<Button type="submit" disabled={lookup.isPending}>
							{lookup.isPending
								? t("loan.other.looking")
								: t("loan.other.look")}
						</Button>
					</div>
					{error ? (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					) : null}
				</StepSection>
			</form>

			{lookup.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{lookup.error.message || t("loan.other.failed")}
					</AlertDescription>
				</Alert>
			) : null}

			{loan ? (
				<section
					className="bg-card shadow-card flex flex-col gap-4 rounded-2xl border p-6"
					aria-labelledby="other-loan-result"
				>
					<div className="flex flex-col gap-1">
						<h2 id="other-loan-result" className="text-base font-semibold">
							{loan.title || t("loan.fallbackTitle")}
						</h2>
						{loan.typeName ? (
							<p className="text-muted-foreground text-sm">{loan.typeName}</p>
						) : null}
					</div>
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
						{row(t("loan.overdue"), loan.overdue ? money(loan.overdue) : null)}
						{row(t("loan.penalty"), loan.penalty ? money(loan.penalty) : null)}
						{row(
							t("loan.progress"),
							loan.totalCount !== null && loan.paidCount !== null
								? t("loan.progressValue", {
										paid: loan.paidCount,
										total: loan.totalCount,
									})
								: null,
						)}
					</dl>
					<div className="flex flex-wrap gap-2">
						<Button type="button" onClick={() => setPaying(true)}>
							{t("loan.pay.action")}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => setPayingByCard(true)}
						>
							{t("loan.pay.cardAction")}
						</Button>
					</div>
				</section>
			) : null}

			{paying && loan ? (
				<PayInstallmentDialog
					loan={loan}
					offerFollow={loan.isOther}
					onClose={() => setPaying(false)}
				/>
			) : null}
			{payingByCard && loan ? (
				<PayInstallmentCardDialog
					loan={loan}
					offerFollow={loan.isOther}
					onClose={() => setPayingByCard(false)}
				/>
			) : null}
		</div>
	)
}
