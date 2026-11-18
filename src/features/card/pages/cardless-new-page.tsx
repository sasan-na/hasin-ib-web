import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { ChoiceCards } from "@/components/flow/choice-cards"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
	cardlessConfigOptions,
	cardsOptions,
} from "@/features/card/api/card.queries"
import { IssueCardlessDialog } from "@/features/card/components/cardless-dialogs"
import { formatAmount, formatCardNumber } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

type Errors = Partial<Record<"card" | "mobile" | "amount" | "password", string>>

const digits = (value: string): string =>
	normalizeDigits(value).replace(/\D/g, "")

/** Issue a one-time withdrawal ticket: the receiver takes cash from an ATM with their mobile number and a password you choose. */
export default function CardlessNewPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const cards = useQuery(cardsOptions(language))
	const config = useQuery(cardlessConfigOptions())

	const [cardId, setCardId] = useState("")
	const [mobile, setMobile] = useState("")
	const [amount, setAmount] = useState("")
	const [password, setPassword] = useState("")
	const [remember, setRemember] = useState(false)
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const limits = config.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const money = (value: number): string =>
		`${formatAmount(value, language)} ${t("card.rial")}`

	const review = (): void => {
		if (!limits) return
		const found: Errors = {}
		if (!card) found.card = t("card.cardless.error.card")
		if (!/^09\d{9}$/.test(mobile))
			found.mobile = t("card.cardless.error.mobile")
		if (amountValue < limits.minAmount || amountValue > limits.maxAmount) {
			found.amount = t("card.cardless.error.between", {
				min: formatAmount(limits.minAmount, language),
				max: formatAmount(limits.maxAmount, language),
			})
		} else if (amountValue % limits.ratio !== 0) {
			found.amount = t("card.cardless.error.ratio", {
				value: formatAmount(limits.ratio, language),
			})
		}
		if (
			password.length < limits.minPasswordLength ||
			password.length > limits.maxPasswordLength
		) {
			found.password = t("card.cardless.error.password", {
				min: formatAmount(limits.minPasswordLength, language),
				max: formatAmount(limits.maxPasswordLength, language),
			})
		}
		setErrors(found)
		if (Object.keys(found).length === 0) setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.cardless.newTitle")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("card.cardless.intro")}
			</p>

			{config.isError ? (
				<p
					role="alert"
					className="bg-card text-destructive rounded-2xl p-5 text-sm"
				>
					{t("card.cardless.configError")}
				</p>
			) : (
				<form
					noValidate
					onSubmit={(event) => {
						event.preventDefault()
						review()
					}}
				>
					<FlowLayout
						aside={
							<FlowSummary
								id="cl-summary"
								title={t("card.cardless.summary")}
								amount={amountValue > 0 ? money(amountValue) : null}
								rows={[
									{
										label: t("card.cardless.card"),
										value: card
											? card.name || formatCardNumber(card.number)
											: null,
									},
									{
										label: t("card.cardless.mobile"),
										value: /^09\d{9}$/.test(mobile) ? mobile : null,
									},
								]}
								reviewLabel={t("card.cardless.review")}
								onReview={review}
							/>
						}
					>
						<StepSection
							id="cl-card-step"
							step={1}
							title={t("card.cardless.card")}
						>
							<p id="cl-card-label" className="sr-only">
								{t("card.cardless.card")}
							</p>
							{cards.isPending ? (
								<Skeleton className="h-24 w-full" />
							) : cards.isError ? (
								<FieldError>{t("card.cardless.cardsError")}</FieldError>
							) : (
								<ChoiceCards
									name="cl-card"
									labelledBy="cl-card-label"
									value={card?.id ?? null}
									onChange={(id) => setCardId(String(id))}
									choices={cards.data.map((candidate) => ({
										id: candidate.id,
										title: candidate.name || candidate.type,
										number: formatCardNumber(candidate.number),
									}))}
								/>
							)}
							{errors.card ? <FieldError>{errors.card}</FieldError> : null}
						</StepSection>

						<StepSection
							id="cl-receiver-step"
							step={2}
							title={t("card.cardless.receiverStep")}
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="cl-mobile">{t("card.cardless.mobile")}</Label>
								<Input
									id="cl-mobile"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									maxLength={11}
									className="h-11 text-base"
									value={mobile}
									aria-invalid={errors.mobile !== undefined}
									onChange={(event) => setMobile(digits(event.target.value))}
								/>
								{errors.mobile ? (
									<FieldError>{errors.mobile}</FieldError>
								) : null}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="cl-password">
									{t("card.cardless.password")}
								</Label>
								<Input
									id="cl-password"
									type="password"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									maxLength={limits?.maxPasswordLength ?? 12}
									className="h-11 max-w-64 text-base"
									value={password}
									aria-invalid={errors.password !== undefined}
									onChange={(event) => setPassword(digits(event.target.value))}
								/>
								<p className="text-muted-foreground text-xs">
									{t("card.cardless.passwordHint")}
								</p>
								{errors.password ? (
									<FieldError>{errors.password}</FieldError>
								) : null}
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="cl-remember"
									checked={remember}
									onCheckedChange={(on) => setRemember(on === true)}
								/>
								<Label htmlFor="cl-remember">
									{t("card.cardless.remember")}
								</Label>
							</div>
						</StepSection>

						<StepSection
							id="cl-amount-step"
							step={3}
							title={t("card.cardless.amount")}
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="cl-amount" className="sr-only">
									{t("card.cardless.amount")}
								</Label>
								<Input
									id="cl-amount"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									maxLength={13}
									className={AMOUNT_INPUT_CLASS}
									value={amount}
									aria-invalid={errors.amount !== undefined}
									onChange={(event) =>
										setAmount(digits(event.target.value).replace(/^0+/, ""))
									}
								/>
								{amount !== "" ? (
									<p className="text-muted-foreground text-sm">
										{money(amountValue)}
									</p>
								) : null}
								{limits ? (
									<p className="text-muted-foreground text-xs">
										{t("card.cardless.limits", {
											min: formatAmount(limits.minAmount, language),
											max: formatAmount(limits.maxAmount, language),
											ratio: formatAmount(limits.ratio, language),
										})}
									</p>
								) : null}
								{errors.amount ? (
									<FieldError>{errors.amount}</FieldError>
								) : null}
							</div>
							<div>
								<Button asChild variant="outline">
									<Link to={routeMap.cardlessList.path}>
										{t("card.cardless.back")}
									</Link>
								</Button>
							</div>
						</StepSection>
					</FlowLayout>
				</form>
			)}

			{confirming && card ? (
				<IssueCardlessDialog
					cardId={card.id}
					cardNumber={card.number}
					mobile={mobile}
					amount={amountValue}
					password={password}
					remember={remember}
					onClose={() => setConfirming(false)}
				/>
			) : null}
		</div>
	)
}
