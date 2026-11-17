import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {PasswordInput} from "@/features/auth/components/password-input"
import {changeCardPin} from "@/features/card/api/card-pin"
import {cardCredentialInfoOptions, cardsOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the text message that proves a PIN change.
const CODE_SERVICE = "ChangeCardPIN"
const PIN_LENGTH = 4
const FRESH: CredentialsForm = {...EMPTY_CREDENTIALS, method: "sms"}

/** Choose a new PIN for a card: prove the card with its details and a code the bank texts, then confirm. */
export default function ChangeCardPinPage() {
	const {t, i18n} = useTranslation()
	const cards = useQuery(cardsOptions(i18n.language))
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(FRESH)
	const [newPin, setNewPin] = useState("")
	const [confirm, setConfirm] = useState("")
	const [error, setError] = useState("")
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({...cardCredentialInfoOptions(card?.id ?? 0, i18n.language), enabled: card !== undefined})
	const credentials = card ? toCredentials(card.number, form, info.data) : null

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || newPin.length !== PIN_LENGTH) throw new Error("form incomplete")
			return changeCardPin(credentials, newPin)
		},
		again: {to: routeMap.cardChangePin.path, label: t("card.pin.again")},
		failedText: t("card.pin.failed"),
		uncertainText: t("card.pin.uncertain"),
	})

	const review = (): void => {
		if (!card || !credentials) return setError(t("card.pin.error.card"))
		if (newPin.length !== PIN_LENGTH) return setError(t("card.pin.error.length", {length: PIN_LENGTH}))
		if (newPin !== confirm) return setError(t("card.pin.error.mismatch"))
		setError("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.pin.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("card.pin.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="pin-card">{t("card.pin.card")}</Label>
					{cards.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : cards.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("card.pin.cardsError")}
						</p>
					) : (
						<Select
							value={cardId}
							onValueChange={(value) => {
								setCardId(value)
								// The secrets typed belong to the card chosen before.
								setForm(FRESH)
							}}
						>
							<SelectTrigger id="pin-card" className="w-full">
								<SelectValue placeholder={t("card.pin.chooseCard")} />
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

				{card && isCredentialsComplete(form, info.data) ? (
					<>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pin-new">{t("card.pin.new")}</Label>
							<PasswordInput id="pin-new" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={newPin} onChange={(event) => setNewPin(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pin-confirm">{t("card.pin.confirm")}</Label>
							<PasswordInput id="pin-confirm" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={confirm} onChange={(event) => setConfirm(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
						</div>
					</>
				) : null}

				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
				<div>
					<Button type="button" disabled={!card} onClick={review}>
						{t("card.pin.review")}
					</Button>
				</div>
			</section>

			{confirming && card ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("card.pin.confirmTitle")}
					description={t("card.pin.confirmQuestion")}
					summary={[{label: t("card.pin.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>}]}
					confirmLabel={t("card.pin.save")}
					pendingLabel={t("card.pin.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
