import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
	AMOUNT_INPUT_CLASS,
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { calculateInterest } from "@/features/loan/api/interest"
import { interestOptionsOptions } from "@/features/loan/api/loan.queries"
import { formatAmount } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"
import { cn } from "@/lib/utils"

const digits = (value: string): string =>
	normalizeDigits(value).replace(/\D/g, "").replace(/^0+/, "")

/** What a loan would cost: pick one of the bank's loan kinds, an amount and a number of installments. Nothing is requested. */
export default function LoanInterestPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const options = useQuery(interestOptionsOptions())
	const [offerIndex, setOfferIndex] = useState<number | null>(null)
	const [amount, setAmount] = useState("")
	const [installments, setInstallments] = useState("")
	const [kindId, setKindId] = useState("")
	const [lifeInsurance, setLifeInsurance] = useState(false)
	const [mehr, setMehr] = useState(false)
	const [error, setError] = useState("")

	const calculation = useMutation({ mutationFn: calculateInterest })
	const result = calculation.data
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const money = (value: number): string =>
		`${formatAmount(value, language)} ${t("loan.rial")}`

	const offer =
		offerIndex === null ? undefined : options.data?.offers[offerIndex]
	const kinds = offer
		? ((offer.stepped
				? options.data?.steppedKinds
				: options.data?.plainKinds) ?? [])
		: []
	// With one repayment kind there is nothing to choose, so it is simply used (as in the legacy page).
	const chosenKind =
		kindId !== "" && kinds.some((kind) => String(kind.id) === kindId)
			? kindId
			: kinds.length === 1
				? String(kinds[0].id)
				: ""

	const submit = (): void => {
		if (!offer) return setError(t("loan.interest.error.offer"))
		const value = Number(amount)
		if (!(value > 0)) return setError(t("loan.interest.error.amount"))
		if (offer.maxAmount > 0 && value > offer.maxAmount)
			return setError(
				t("loan.interest.error.max", { amount: money(offer.maxAmount) }),
			)
		const count = Number(installments)
		if (!(count > 0)) return setError(t("loan.interest.error.count"))
		if (chosenKind === "") return setError(t("loan.interest.error.kind"))
		setError("")
		calculation.mutate({
			offer,
			amount: value,
			installments: count,
			kindId: Number(chosenKind),
			lifeInsurance,
			mehr,
		})
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("loan.interest.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.loan.path}>
						<BackIcon aria-hidden="true" />
						{t("loan.interest.back")}
					</Link>
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">{t("loan.interest.hint")}</p>

			{options.isPending ? (
				<Skeleton className="h-40 w-full" />
			) : options.isError ? (
				<p
					role="alert"
					className="bg-card text-destructive shadow-card rounded-2xl border p-5 text-sm"
				>
					{options.error.message || t("loan.interest.loadError")}
				</p>
			) : (
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault()
						submit()
					}}
				>
					<FlowLayout
						aside={
							<FlowSummary
								id="interest-summary"
								title={t("loan.interest.summary")}
								amount={Number(amount) > 0 ? money(Number(amount)) : null}
								rows={[
									{
										label: t("loan.interest.offers"),
										value: offer ? offer.title : null,
									},
									{
										label: t("loan.interest.installments"),
										value:
											Number(installments) > 0
												? formatAmount(Number(installments), language)
												: null,
									},
									{
										label: t("loan.interest.kind"),
										value:
											kinds.find((kind) => String(kind.id) === chosenKind)
												?.name ?? null,
									},
								]}
								reviewLabel={
									calculation.isPending
										? t("loan.interest.calculating")
										: t("loan.interest.calculate")
								}
								onReview={() => {
									if (!calculation.isPending) submit()
								}}
							/>
						}
					>
						<StepSection
							id="interest-offers-step"
							step={1}
							title={t("loan.interest.offers")}
						>
							{options.data.offers.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("loan.interest.noOffers")}
								</p>
							) : null}
							<div
								role="radiogroup"
								aria-label={t("loan.interest.offers")}
								className="grid gap-3 sm:grid-cols-2"
							>
								{options.data.offers.map((item, index) => (
									<label
										key={index}
										className={cn(
											"bg-card flex min-h-11 cursor-pointer flex-col gap-1 rounded-xl border p-4 text-sm transition-colors",
											offerIndex === index
												? "border-primary bg-primary-soft ring-primary/20 ring-2"
												: "hover:border-foreground/40",
										)}
									>
										<span className="flex items-center gap-3">
											<input
												type="radio"
												name="offer"
												checked={offerIndex === index}
												onChange={() => {
													setOfferIndex(index)
													setKindId("")
													setError("")
												}}
											/>
											<span className="font-medium">{item.title}</span>
										</span>
										<span className="text-muted-foreground">
											{t("loan.interest.maxAmount")}: {money(item.maxAmount)} ·{" "}
											{t("loan.interest.rate")}:{" "}
											{formatAmount(item.rate, language)}%
											{item.stepped ? ` · ${t("loan.interest.stepped")}` : ""}
										</span>
									</label>
								))}
							</div>
						</StepSection>

						<StepSection
							id="interest-details-step"
							step={2}
							title={t("loan.interest.detailsStep")}
						>
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="flex flex-col gap-2">
									<Label htmlFor="interest-amount">
										{t("loan.interest.amount")}
									</Label>
									<Input
										id="interest-amount"
										dir="ltr"
										inputMode="numeric"
										autoComplete="off"
										maxLength={12}
										className={AMOUNT_INPUT_CLASS}
										value={amount}
										disabled={!offer}
										onChange={(event) => setAmount(digits(event.target.value))}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="interest-count">
										{t("loan.interest.installments")}
									</Label>
									<Input
										id="interest-count"
										dir="ltr"
										inputMode="numeric"
										autoComplete="off"
										maxLength={3}
										className="h-11 text-base"
										value={installments}
										disabled={!offer}
										onChange={(event) =>
											setInstallments(digits(event.target.value))
										}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="interest-kind">
										{t("loan.interest.kind")}
									</Label>
									<Select
										value={chosenKind}
										onValueChange={setKindId}
										disabled={!offer}
									>
										<SelectTrigger id="interest-kind" className="h-11 w-full">
											<SelectValue
												placeholder={t("loan.interest.chooseKind")}
											/>
										</SelectTrigger>
										<SelectContent>
											{kinds.map((kind) => (
												<SelectItem key={kind.id} value={String(kind.id)}>
													{kind.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							{amount ? (
								<p className="text-muted-foreground text-sm">
									{money(Number(amount))}
								</p>
							) : null}

							<div className="flex flex-wrap gap-6">
								<div className="flex items-center gap-2">
									<Checkbox
										id="interest-life"
										checked={lifeInsurance}
										disabled={!offer}
										onCheckedChange={(checked) =>
											setLifeInsurance(checked === true)
										}
									/>
									<Label htmlFor="interest-life">
										{t("loan.interest.lifeInsurance")}
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<Checkbox
										id="interest-mehr"
										checked={mehr}
										disabled={!offer}
										onCheckedChange={(checked) => setMehr(checked === true)}
									/>
									<Label htmlFor="interest-mehr">
										{t("loan.interest.mehr")}
									</Label>
								</div>
							</div>

							{error ? <FieldError>{error}</FieldError> : null}
						</StepSection>
					</FlowLayout>
				</form>
			)}

			{calculation.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{calculation.error.message || t("loan.interest.failed")}
					</AlertDescription>
				</Alert>
			) : null}

			{result ? (
				<section
					aria-labelledby="interest-result"
					className="bg-card shadow-card flex flex-col gap-4 rounded-2xl border p-6"
				>
					<h2 id="interest-result" className="text-base font-semibold">
						{t("loan.interest.result")}
					</h2>
					<dl className="grid gap-3 sm:grid-cols-2">
						{result.kind ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("loan.interest.kind")}
								</dt>
								<dd>{result.kind}</dd>
							</div>
						) : null}
						{result.installments !== null ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("loan.interest.installments")}
								</dt>
								<dd>{formatAmount(result.installments, language)}</dd>
							</div>
						) : null}
						{result.amount !== null ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("loan.interest.amount")}
								</dt>
								<dd>{money(result.amount)}</dd>
							</div>
						) : null}
						{result.profit !== null ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("loan.interest.profit")}
								</dt>
								<dd className="text-lg font-bold">{money(result.profit)}</dd>
							</div>
						) : null}
					</dl>
					{result.periods.length > 0 ? (
						<ul className="flex flex-col divide-y rounded-md border">
							{result.periods.map((period, index) => (
								<li
									key={index}
									className="flex flex-wrap justify-between gap-2 p-3 text-sm"
								>
									<span>{period.label}</span>
									{period.amount !== null ? (
										<span className="font-medium">{money(period.amount)}</span>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</section>
			) : null}
		</div>
	)
}
