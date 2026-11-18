import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
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
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("topup.voucher.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.topUp.path}>{t("topup.voucher.toTopUp")}</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("topup.voucher.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="vc-operator">{t("topup.operator")}</Label>
					{operators.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : operators.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("topup.voucher.loadError")}
						</p>
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
						{chosen.vouchers.map((voucher) => (
							<label key={voucher.amount} className="flex items-center gap-2 text-sm">
								<input type="radio" name="vc-amount" className="accent-primary" checked={amount === String(voucher.amount)} onChange={() => setAmount(String(voucher.amount))} />
								{voucher.description}
							</label>
						))}
					</fieldset>
				) : null}
				<div className="flex flex-col gap-2">
					<Label htmlFor="vc-card">{t("topup.card")}</Label>
					{cards.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : cards.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("topup.cardsError")}
						</p>
					) : (
						<Select
							value={cardId}
							onValueChange={(next) => {
								setCardId(next)
								setForm(EMPTY_CREDENTIALS)
							}}
						>
							<SelectTrigger id="vc-card" className="w-full">
								<SelectValue placeholder={t("topup.chooseCard")} />
							</SelectTrigger>
							<SelectContent>
								{cards.data.map((candidate) => (
									<SelectItem key={candidate.id} value={String(candidate.id)}>
										<span>{candidate.name || candidate.type}</span> <span dir="ltr">{formatCardNumber(candidate.number)}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				{card ? <CardCredentialsFields cardId={card.id} cardNumber={card.number} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} /> : null}

				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
				<div>
					<Button type="button" onClick={review}>
						{t("topup.review")}
					</Button>
				</div>
			</section>

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
