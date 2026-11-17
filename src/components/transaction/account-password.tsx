import {useQuery} from "@tanstack/react-query"
import {useEffect, useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {requestAccountCode, type PasswordInfo} from "@/lib/api/transaction"
import {passwordInfoOptions, transactionConfigOptions} from "@/lib/api/transaction.queries"
import {normalizeDigits} from "@/lib/auth/normalizeDigits"

// Limits from the legacy field: digits only, 5 to 12 of them. The SMS code is requested at most once a minute.
export const PASSWORD_MIN = 5
export const PASSWORD_MAX = 12
const RESEND_SECONDS = 60

export type PasswordRequirement =
	| {state: "idle"}
	| {state: "loading"}
	| {state: "error"}
	| {state: "ready"; info: PasswordInfo; needsPassword: boolean}

interface RequirementInput {
	accountId: number | null
	/** The service name the bank keys its no-password limits by ("OpenAccount"). */
	limitServiceName: string
	amount: number
}

/**
 * Whether the account's password (or code) must be entered for this transaction. An account with a regular
 * password or a token always needs it. An account set to "no password" needs it only above the bank's limit for
 * the service; with no limit configured it never does.
 */
export const usePasswordRequirement = ({accountId, limitServiceName, amount}: RequirementInput): PasswordRequirement => {
	const {i18n} = useTranslation()
	const info = useQuery({...passwordInfoOptions(accountId ?? 0, i18n.language), enabled: accountId !== null})
	const config = useQuery({...transactionConfigOptions(), enabled: accountId !== null})

	if (accountId === null) return {state: "idle"}
	if (info.isError || config.isError) return {state: "error"}
	if (!info.data || !config.data) return {state: "loading"}

	const limit = config.data.noPasswordLimits[limitServiceName]
	const needsPassword = info.data.type !== 2 || (limit !== undefined && amount > limit)
	return {state: "ready", info: info.data, needsPassword}
}

/** True when the entered password is acceptable for this requirement (or none is needed). */
export const isPasswordComplete = (requirement: PasswordRequirement, value: string): boolean =>
	requirement.state === "ready" && (!requirement.needsPassword || (value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX))

interface AccountPasswordProps {
	requirement: PasswordRequirement
	accountNumber: string
	/** The service name the bank expects when it texts the code ("OpeningAccount"). */
	codeServiceName: string
	amount: number
	value: string
	onChange: (value: string) => void
	disabled?: boolean
}

/** The account's password or one-time code, with a button to have the bank text the code when it works that way. */
export function AccountPassword({requirement, accountNumber, codeServiceName, amount, value, onChange, disabled = false}: AccountPasswordProps) {
	const {t} = useTranslation()
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

	if (requirement.state === "idle") return null
	if (requirement.state === "loading") return <Skeleton className="h-9 w-full" />
	if (requirement.state === "error") {
		return (
			<p role="alert" className="text-sm text-destructive">
				{t("transaction.passwordInfoError")}
			</p>
		)
	}
	if (!requirement.needsPassword) return <p className="text-sm text-muted-foreground">{t("transaction.noPasswordNeeded")}</p>

	const {info} = requirement
	const secondsLeft = nextSendAt === null ? 0 : Math.max(0, Math.ceil((nextSendAt - now) / 1000))
	// A code that is texted on request cannot be typed before it has been asked for.
	const inputLocked = disabled || (info.sendsSmsCode && !codeSent)
	const label = info.type === 3 || info.codeName === "" ? t("transaction.accountPassword") : info.codeName

	const sendCode = async (): Promise<void> => {
		setSending(true)
		setCodeProblem(null)
		try {
			const result = await requestAccountCode(accountNumber, codeServiceName, amount)
			if (result.ok) {
				setCodeSent(true)
				setNextSendAt(Date.now() + RESEND_SECONDS * 1000)
				setNow(Date.now())
			} else {
				setCodeProblem(result.message || t("transaction.codeError"))
			}
		} catch {
			setCodeProblem(t("transaction.codeError"))
		} finally {
			setSending(false)
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor="account-password">{label}</Label>
			<div className="flex items-center gap-2">
				<Input
					id="account-password"
					type="password"
					inputMode="numeric"
					autoComplete="off"
					dir="ltr"
					maxLength={PASSWORD_MAX}
					value={value}
					disabled={inputLocked}
					onChange={(event) => onChange(normalizeDigits(event.target.value).replace(/\D/g, ""))}
				/>
				{info.sendsSmsCode ? (
					<Button type="button" variant="outline" disabled={disabled || sending || secondsLeft > 0} onClick={() => void sendCode()}>
						{sending ? t("transaction.sendingCode") : secondsLeft > 0 ? t("transaction.resendIn", {seconds: secondsLeft}) : codeSent ? t("transaction.resendCode") : t("transaction.sendCode")}
					</Button>
				) : null}
			</div>
			{codeSent && codeProblem === null ? (
				<p role="status" className="text-sm text-muted-foreground">
					{t("transaction.codeSent")}
				</p>
			) : null}
			{codeProblem !== null ? (
				<p role="alert" className="text-sm text-destructive">
					{codeProblem}
				</p>
			) : null}
			{value.length > 0 && value.length < PASSWORD_MIN ? (
				<p className="text-sm text-muted-foreground">{t("transaction.passwordMin", {min: PASSWORD_MIN})}</p>
			) : null}
		</div>
	)
}
