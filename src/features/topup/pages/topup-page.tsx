import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardCredentialInfoOptions, cardsOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {getOperators, getTopUpLimits, topUp} from "@/features/topup/api/topup"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the text message that proves a top-up from a card.
const CODE_SERVICE = "TopUp"

/** Top up a mobile number's credit from one of the user's cards. */
export default function TopUpPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const operators = useQuery({queryKey: ["topup", "operators"], queryFn: getOperators, staleTime: 10 * 60_000, retry: false})
	const limits = useQuery({queryKey: ["topup", "limits"], queryFn: getTopUpLimits, staleTime: 10 * 60_000, retry: false})
	const cards = useQuery(cardsOptions(language))
	const [operator, setOperator] = useState("")
	const [mobile, setMobile] = useState("")
	const [amount, setAmount] = useState("")
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const [error, setError] = useState("")
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({...cardCredentialInfoOptions(card?.id ?? 0, language), enabled: card !== undefined})
	const credentials = card ? toCredentials(card.number, form, info.data) : null
	const value = amount === "" ? 0 : Number(amount)
	const money = (number: number): string => `${formatAmount(number, language)} ${t("topup.rial")}`
	const operatorName = operators.data?.find((item) => item.key === operator)?.name ?? operator

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || value <= 0) throw new Error("form incomplete")
			return topUp({credentials, operator, mobile, amount: value})
		},
		again: {to: routeMap.topUp.path, label: t("topup.again")},
		failedText: t("topup.failed"),
		uncertainText: t("topup.uncertain"),
	})

	const review = (): void => {
		const range = limits.data
		if (operator === "") return setError(t("topup.error.operator"))
		if (!/^09\d{9}$/.test(mobile)) return setError(t("topup.error.mobile"))
		if (value <= 0) return setError(t("topup.error.amount"))
		if (range && range.min > 0 && value < range.min) return setError(t("topup.error.min", {amount: money(range.min)}))
		if (range && range.max > 0 && value > range.max) return setError(t("topup.error.max", {amount: money(range.max)}))
		if (range && range.step > 1 && value % range.step !== 0) return setError(t("topup.error.step", {amount: money(range.step)}))
		if (!card || !credentials) return setError(t("topup.error.card"))
		setError("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("topup.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.voucher.path}>{t("topup.toVoucher")}</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("topup.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="tu-operator">{t("topup.operator")}</Label>
					{operators.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : operators.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("topup.operatorsError")}
						</p>
					) : (
						<Select value={operator} onValueChange={setOperator}>
							<SelectTrigger id="tu-operator" className="w-full">
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
				<div className="flex flex-col gap-2">
					<Label htmlFor="tu-mobile">{t("topup.mobile")}</Label>
					<Input id="tu-mobile" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={11} className="max-w-60" value={mobile} onChange={(event) => setMobile(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="tu-amount">{t("topup.amount")}</Label>
					<Input id="tu-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={10} className="max-w-60" value={amount} onChange={(event) => setAmount(normalizeDigits(event.target.value).replace(/\D/g, "").replace(/^0+/, ""))} />
					{amount !== "" ? <p className="text-sm text-muted-foreground">{money(value)}</p> : null}
					{limits.data && (limits.data.min > 0 || limits.data.max > 0) ? <p className="text-xs text-muted-foreground">{t("topup.limits", {min: money(limits.data.min), max: money(limits.data.max), step: money(limits.data.step)})}</p> : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="tu-card">{t("topup.card")}</Label>
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
							<SelectTrigger id="tu-card" className="w-full">
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

			{confirming && card ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("topup.confirmTitle")}
					description={t("topup.confirmQuestion")}
					summary={[
						{label: t("topup.operator"), value: operatorName},
						{label: t("topup.mobile"), value: <span dir="ltr">{mobile}</span>},
						{label: t("topup.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>},
						{label: t("topup.amount"), amount: true, value: money(value)},
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
