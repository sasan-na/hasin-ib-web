import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {ChoiceCards} from "@/components/flow/choice-cards"
import {FieldError, FlowLayout, FlowSummary, StepSection} from "@/components/flow/flow-form"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardCredentialInfoOptions, cardsOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {getVoucherOperators, purchaseVoucher} from "@/features/topup/api/topup"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {cn} from "@/lib/utils"

// The bank's name for the text message that proves a charge card purchase from a card.
const CODE_SERVICE = "PurchaseVoucher"

/** Buy a mobile charge card (voucher) with one of the user's cards. Its serial and PIN appear on the receipt. */
export default function VoucherPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const operators = useQuery({queryKey: ["topup", "vouchers"], queryFn: getVoucherOperators, staleTime: 10 * 60_000, retry: false})
	const cards = useQuery(cardsOptions(language))
	const [operator, setOperator] = useState("")
	const [amount, setAmount] = useState("")
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const [error, setError] = useState("")
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({...cardCredentialInfoOptions(card?.id ?? 0, language), enabled: card !== undefined})
	const credentials = card ? toCredentials(card.number, form, info.data) : null
	const chosen = operators.data?.find((item) => item.key === operator)
	const value = Number(amount)
	const money = (number: number): string => `${formatAmount(number, language)} ${t("topup.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || !(value > 0)) throw new Error("form incomplete")
			return purchaseVoucher({credentials, operator, amount: value})
		},
		again: {to: routeMap.voucher.path, label: t("topup.voucher.again")},
		failedText: t("topup.voucher.failed"),
		uncertainText: t("topup.voucher.uncertain"),
	})

	const review = (): void => {
		if (!chosen) return setError(t("topup.error.operator"))
		if (!chosen.vouchers.some((voucher) => String(voucher.amount) === amount)) return setError(t("topup.voucher.error.amount"))
		if (!card || !credentials) return setError(t("topup.error.card"))
		setError("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("topup.voucher.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.topUp.path}>{t("topup.voucher.toTopUp")}</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("topup.voucher.hint")}</p>

			<FlowLayout
				aside={
					<FlowSummary
						id="vc-summary"
						title={t("topup.voucher.summary")}
						amount={value > 0 && chosen?.vouchers.some((voucher) => String(voucher.amount) === amount) ? money(value) : null}
						rows={[
							{label: t("topup.operator"), value: chosen ? chosen.name : null},
							{label: t("topup.card"), value: card ? card.name || card.type : null},
						]}
						reviewLabel={t("topup.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="vc-choose" step={1} title={t("topup.voucher.chooseStep")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="vc-operator">{t("topup.operator")}</Label>
						{operators.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : operators.isError ? (
							<FieldError>{t("topup.voucher.loadError")}</FieldError>
						) : (
							<Select
								value={operator}
								onValueChange={(next) => {
									setOperator(next)
									setAmount("")
								}}
							>
								<SelectTrigger id="vc-operator" className="w-full">
									<SelectValue placeholder={t("topup.chooseOperator")} />
								</SelectTrigger>
								<SelectContent>
									{operators.data.map((item) => (
										<SelectItem key={item.key} value={item.key}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					{chosen ? (
						<fieldset className="flex flex-col gap-2">
							<legend className="mb-1 text-sm font-medium">{t("topup.voucher.value")}</legend>
							<div className="grid gap-2 sm:grid-cols-2">
								{chosen.vouchers.map((voucher) => (
									<label
										key={voucher.amount}
										className={cn(
											"flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-card p-3 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50",
											amount === String(voucher.amount) ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "hover:border-foreground/40",
										)}
									>
										<input type="radio" name="vc-amount" className="accent-primary" checked={amount === String(voucher.amount)} onChange={() => setAmount(String(voucher.amount))} />
										{voucher.description}
									</label>
								))}
							</div>
						</fieldset>
					) : null}
				</StepSection>

				<StepSection id="vc-from" step={2} title={t("topup.fromStep")}>
					<p id="vc-card-label" className="sr-only">
						{t("topup.card")}
					</p>
					{cards.isPending ? (
						<Skeleton className="h-24 w-full" />
					) : cards.isError ? (
						<FieldError>{t("topup.cardsError")}</FieldError>
					) : (
						<ChoiceCards
							name="vc-card"
							labelledBy="vc-card-label"
							value={card?.id ?? null}
							onChange={(id) => {
								setCardId(String(id))
								setForm(EMPTY_CREDENTIALS)
							}}
							choices={cards.data.map((candidate) => ({id: candidate.id, title: candidate.name || candidate.type, number: formatCardNumber(candidate.number)}))}
						/>
					)}
					{card ? <CardCredentialsFields cardId={card.id} cardNumber={card.number} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} /> : null}
					{error ? <FieldError>{error}</FieldError> : null}
				</StepSection>
			</FlowLayout>

			{confirming && card && chosen ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("topup.voucher.confirmTitle")}
					description={t("topup.voucher.confirmQuestion")}
					summary={[
						{label: t("topup.operator"), value: chosen.name},
						{label: t("topup.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>},
						{label: t("topup.voucher.value"), amount: true, value: money(value)},
					]}
					confirmLabel={t("topup.pay")}
					pendingLabel={t("topup.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
