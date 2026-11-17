import {useQuery} from "@tanstack/react-query"
import {useEffect, useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {Skeleton} from "@/components/ui/skeleton"
import {requestCardCode, type CardCredentialInfo, type CardCredentials} from "@/features/card/api/card-credentials"
import {cardCredentialInfoOptions} from "@/features/card/api/card.queries"
import {normalizeDigits} from "@/lib/normalize-digits"

// Limits from the legacy form. The SMS code can be asked for at most once a minute.
const PIN_MIN = 5
const PIN_MAX = 12
const OTP_MIN = 6
const OTP_MAX = 12
const RESEND_SECONDS = 60

/** What the user has typed so far. `null` means "not touched": the value the user saved with the bank, if any, shows instead. */
export interface CredentialsForm {
	cvv2: string | null
	month: string | null
	year: string | null
	pin2: string
	otp: string
	/** Where the card password comes from: the user knows it, or the bank texts a code. */
	method: "pin" | "sms"
}

export const EMPTY_CREDENTIALS: CredentialsForm = {cvv2: null, month: null, year: null, pin2: "", otp: "", method: "pin"}

const digitsOnly = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** The form with saved values filled in where nothing was typed. */
const effective = (form: CredentialsForm, info: CardCredentialInfo) => ({
	cvv2: form.cvv2 ?? info.saved.cvv2,
	month: form.month ?? info.saved.month,
	year: form.year ?? info.saved.year,
})

const validMonth = (month: string): boolean => /^(0[1-9]|1[0-2])$/.test(month)
const validDate = (cvv2: string, month: string, year: string): boolean => cvv2.length >= 3 && cvv2.length <= 4 && validMonth(month) && /^\d{2}$/.test(year)

/** True when everything the bank needs for this card is filled in acceptably. */
export const isCredentialsComplete = (form: CredentialsForm, info: CardCredentialInfo | undefined): boolean => {
	if (!info) return false
	const {cvv2, month, year} = effective(form, info)
	return (
		validDate(cvv2, month, year) &&
		form.pin2.length >= PIN_MIN &&
		form.pin2.length <= PIN_MAX &&
		(!info.hasOtp || (form.otp.length >= OTP_MIN && form.otp.length <= OTP_MAX))
	)
}

/** The secrets to send, or null while the form is incomplete. */
export const toCredentials = (pan: string, form: CredentialsForm, info: CardCredentialInfo | undefined): CardCredentials | null => {
	if (!info || !isCredentialsComplete(form, info)) return null
	const {cvv2, month, year} = effective(form, info)
	return {pan, cvv2, expiryMonth: month, expiryYear: year, pin2: form.pin2, otp: info.hasOtp ? form.otp : null}
}

interface CardCredentialsProps {
	cardId: number
	cardNumber: string
	/** The bank's service name for the SMS code ("CardAuthorize"). */
	codeServiceName: string
	value: CredentialsForm
	onChange: (form: CredentialsForm) => void
	disabled?: boolean
}

/** The card's secrets for a transaction: card password (or an SMS code), CVV2, expiry and, for token cards, the OTP. */
export function CardCredentialsFields({cardId, cardNumber, codeServiceName, value, onChange, disabled = false}: CardCredentialsProps) {
	const {t, i18n} = useTranslation()
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const [sending, setSending] = useState(false)
	const [codeSent, setCodeSent] = useState(false)
	const [codeProblem, setCodeProblem] = useState<string | null>(null)
	const [nextSendAt, setNextSendAt] = useState<number | null>(null)
	const [now, setNow] = useState(() => Date.now())

	// Tick only while the resend lock is running.
	useEffect(() => {
		if (nextSendAt === null) return
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [nextSendAt])

	if (info.isPending) return <Skeleton className="h-32 w-full" />
	if (info.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				{t("card.credentials.error")}
			</p>
		)
	}

	const shown = effective(value, info.data)
	const secondsLeft = nextSendAt === null ? 0 : Math.max(0, Math.ceil((nextSendAt - now) / 1000))
	const canAskForCode = validDate(shown.cvv2, shown.month, shown.year)

	const sendCode = async (): Promise<void> => {
		setSending(true)
		setCodeProblem(null)
		try {
			const result = await requestCardCode({pan: cardNumber, cvv2: shown.cvv2, expiryMonth: shown.month, expiryYear: shown.year}, codeServiceName)
			if (result.ok) {
				setCodeSent(true)
				setNextSendAt(Date.now() + RESEND_SECONDS * 1000)
				setNow(Date.now())
			} else {
				setCodeProblem(result.message || t("card.credentials.codeError"))
			}
		} catch {
			setCodeProblem(t("card.credentials.codeError"))
		} finally {
			setSending(false)
		}
	}

	const set = (patch: Partial<CredentialsForm>): void => onChange({...value, ...patch})

	return (
		<div className="flex flex-col gap-4">
			{info.data.hasOtp ? (
				<div className="flex flex-col gap-2">
					<Label htmlFor="card-otp">{info.data.otpName || t("card.credentials.otp")}</Label>
					<Input
						id="card-otp"
						type="password"
						inputMode="numeric"
						autoComplete="off"
						dir="ltr"
						maxLength={OTP_MAX}
						value={value.otp}
						disabled={disabled}
						onChange={(event) => set({otp: digitsOnly(event.target.value)})}
					/>
				</div>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="card-cvv2">{t("card.credentials.cvv2")}</Label>
					<Input
						id="card-cvv2"
						type="password"
						inputMode="numeric"
						autoComplete="off"
						dir="ltr"
						maxLength={4}
						value={shown.cvv2}
						disabled={disabled}
						onChange={(event) => set({cvv2: digitsOnly(event.target.value)})}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="card-month">{t("card.credentials.expiry")}</Label>
					<div dir="ltr" className="flex items-center gap-2">
						<Input
							id="card-month"
							inputMode="numeric"
							autoComplete="off"
							placeholder={t("card.credentials.month")}
							aria-label={t("card.credentials.month")}
							maxLength={2}
							className="w-20"
							value={shown.month}
							disabled={disabled}
							onChange={(event) => set({month: digitsOnly(event.target.value)})}
						/>
						<span aria-hidden="true">/</span>
						<Input
							id="card-year"
							inputMode="numeric"
							autoComplete="off"
							placeholder={t("card.credentials.year")}
							aria-label={t("card.credentials.year")}
							maxLength={2}
							className="w-20"
							value={shown.year}
							disabled={disabled}
							onChange={(event) => set({year: digitsOnly(event.target.value)})}
						/>
					</div>
				</div>
			</div>

			<RadioGroup
				value={value.method}
				onValueChange={(method) => set({method: method as CredentialsForm["method"], pin2: ""})}
				aria-label={t("card.credentials.passwordSource")}
				className="flex flex-col gap-3"
			>
				<div className="flex items-center gap-3">
					<RadioGroupItem id="card-method-pin" value="pin" disabled={disabled} />
					<Label htmlFor="card-method-pin">{t("card.credentials.havePin")}</Label>
				</div>
				<div className="flex items-center gap-3">
					<RadioGroupItem id="card-method-sms" value="sms" disabled={disabled} />
					<Label htmlFor="card-method-sms">{t("card.credentials.sendCode")}</Label>
				</div>
			</RadioGroup>

			<div className="flex flex-col gap-2">
				<Label htmlFor="card-pin">{value.method === "pin" ? t("card.credentials.pin") : t("card.credentials.code")}</Label>
				<div className="flex items-center gap-2">
					<Input
						id="card-pin"
						type="password"
						inputMode="numeric"
						autoComplete="off"
						dir="ltr"
						maxLength={PIN_MAX}
						value={value.pin2}
						// A texted code cannot be typed before it has been asked for.
						disabled={disabled || (value.method === "sms" && !codeSent)}
						onChange={(event) => set({pin2: digitsOnly(event.target.value)})}
					/>
					{value.method === "sms" ? (
						<Button type="button" variant="outline" disabled={disabled || sending || secondsLeft > 0 || !canAskForCode} onClick={() => void sendCode()}>
							{sending
								? t("card.credentials.sending")
								: secondsLeft > 0
									? t("card.credentials.resendIn", {seconds: secondsLeft})
									: codeSent
										? t("card.credentials.resend")
										: t("card.credentials.send")}
						</Button>
					) : null}
				</div>
				{value.method === "sms" && !canAskForCode ? <p className="text-sm text-muted-foreground">{t("card.credentials.needDate")}</p> : null}
				{codeSent && codeProblem === null ? (
					<p role="status" className="text-sm text-muted-foreground">
						{t("card.credentials.codeSent")}
					</p>
				) : null}
				{codeProblem !== null ? (
					<p role="alert" className="text-sm text-destructive">
						{codeProblem}
					</p>
				) : null}
			</div>
		</div>
	)
}
