import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { routeMap } from "@/app/routes"
import { ChoiceCards } from "@/components/flow/choice-cards"
import { FieldError, StepSection } from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordInput } from "@/features/auth/components/password-input"
import { changeCardPin } from "@/features/card/api/card-pin"
import {
	cardCredentialInfoOptions,
	cardsOptions,
} from "@/features/card/api/card.queries"
import {
	CardCredentialsFields,
	EMPTY_CREDENTIALS,
	isCredentialsComplete,
	toCredentials,
	type CredentialsForm,
} from "@/features/card/components/card-credentials"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { formatCardNumber } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

// The bank's name for the text message that proves a PIN change.
const CODE_SERVICE = "ChangeCardPIN"
const PIN_LENGTH = 4
const FRESH: CredentialsForm = { ...EMPTY_CREDENTIALS, method: "sms" }

/** Choose a new PIN for a card: prove the card with its details and a code the bank texts, then confirm. */
export default function ChangeCardPinPage() {
	const { t, i18n } = useTranslation()
	const cards = useQuery(cardsOptions(i18n.language))
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(FRESH)
	const [newPin, setNewPin] = useState("")
	const [confirm, setConfirm] = useState("")
	const [error, setError] = useState("")
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({
		...cardCredentialInfoOptions(card?.id ?? 0, i18n.language),
		enabled: card !== undefined,
	})
	const credentials = card ? toCredentials(card.number, form, info.data) : null

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || newPin.length !== PIN_LENGTH)
				throw new Error("form incomplete")
			return changeCardPin(credentials, newPin)
		},
		again: { to: routeMap.cardChangePin.path, label: t("card.pin.again") },
		failedText: t("card.pin.failed"),
		uncertainText: t("card.pin.uncertain"),
	})

	const review = (): void => {
		if (!card || !credentials) return setError(t("card.pin.error.card"))
		if (newPin.length !== PIN_LENGTH)
			return setError(t("card.pin.error.length", { length: PIN_LENGTH }))
		if (newPin !== confirm) return setError(t("card.pin.error.mismatch"))
		setError("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.pin.title")}</h1>
			<p className="text-muted-foreground text-sm">{t("card.pin.hint")}</p>

			<StepSection id="pin-card-step" step={1} title={t("card.pin.card")}>
				<p id="pin-card-label" className="sr-only">
					{t("card.pin.card")}
				</p>
				{cards.isPending ? (
					<Skeleton className="h-24 w-full" />
				) : cards.isError ? (
					<FieldError>{t("card.pin.cardsError")}</FieldError>
				) : (
					<ChoiceCards
						name="pin-card"
						labelledBy="pin-card-label"
						value={card?.id ?? null}
						onChange={(id) => {
							setCardId(String(id))
							// The secrets typed belong to the card chosen before.
							setForm(FRESH)
						}}
						choices={cards.data.map((candidate) => ({
							id: candidate.id,
							title: candidate.name || candidate.type,
							number: formatCardNumber(candidate.number),
						}))}
					/>
				)}
				{card ? (
					<CardCredentialsFields
						cardId={card.id}
						cardNumber={card.number}
						codeServiceName={CODE_SERVICE}
						value={form}
						onChange={setForm}
					/>
				) : null}
			</StepSection>

			<StepSection id="pin-new-step" step={2} title={t("card.pin.new")}>
				{card && isCredentialsComplete(form, info.data) ? (
					<>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pin-new">{t("card.pin.new")}</Label>
							<PasswordInput
								id="pin-new"
								inputMode="numeric"
								autoComplete="off"
								maxLength={PIN_LENGTH}
								value={newPin}
								onChange={(event) =>
									setNewPin(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
								}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pin-confirm">{t("card.pin.confirm")}</Label>
							<PasswordInput
								id="pin-confirm"
								inputMode="numeric"
								autoComplete="off"
								maxLength={PIN_LENGTH}
								value={confirm}
								onChange={(event) =>
									setConfirm(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
								}
							/>
						</div>
					</>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("card.pin.fillFirst")}
					</p>
				)}
				{error ? <FieldError>{error}</FieldError> : null}
				<div>
					<Button type="button" size="lg" disabled={!card} onClick={review}>
						{t("card.pin.review")}
					</Button>
				</div>
			</StepSection>

			{confirming && card ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("card.pin.confirmTitle")}
					description={t("card.pin.confirmQuestion")}
					summary={[
						{
							label: t("card.pin.card"),
							value: <span dir="ltr">{formatCardNumber(card.number)}</span>,
						},
					]}
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
