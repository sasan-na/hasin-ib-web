import {useMutation} from "@tanstack/react-query"
import {useEffect, useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {sendPhoneCode, verifyMobileNumber, verifyPhoneCode} from "@/features/card/api/dynamic-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {normalizeDigits} from "@/lib/normalize-digits"

const RESEND_SECONDS = 120

/** Registers a mobile number with the bank: it texts a code, and once the code is right the number is confirmed for the user's cards. */
export default function MobileVerificationPage() {
	const {t} = useTranslation()
	const [mobile, setMobile] = useState("")
	const [code, setCode] = useState("")
	const [verified, setVerified] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [nextSendAt, setNextSendAt] = useState<number | null>(null)
	const [now, setNow] = useState(() => Date.now())
	const [problem, setProblem] = useState<string | null>(null)

	// Tick only while the resend lock is running.
	useEffect(() => {
		if (nextSendAt === null) return
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [nextSendAt])
	const secondsLeft = nextSendAt === null ? 0 : Math.max(0, Math.ceil((nextSendAt - now) / 1000))
	const mobileOk = /^09\d{9}$/.test(mobile)

	const send = useMutation({
		mutationFn: () => sendPhoneCode(mobile),
		onSuccess: () => {
			setNextSendAt(Date.now() + RESEND_SECONDS * 1000)
			setNow(Date.now())
			setProblem(null)
		},
		onError: (error: Error) => setProblem(error.message || t("dynamicPassword.codeFailed")),
	})
	const verify = useMutation({
		mutationFn: () => verifyPhoneCode(mobile, code),
		onSuccess: () => {
			setVerified(true)
			setProblem(null)
		},
		onError: (error: Error) => setProblem(error.message || t("dynamicPassword.verifyFailed")),
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!verified) throw new Error("phone not verified")
			return verifyMobileNumber(mobile)
		},
		again: {to: routeMap.mobileVerification.path, label: t("mobileVerification.again")},
		failedText: t("dynamicPassword.failed"),
		uncertainText: t("dynamicPassword.uncertain"),
	})

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("mobileVerification.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("mobileVerification.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="mv-mobile">{t("dynamicPassword.mobile")}</Label>
					<div className="flex items-center gap-2">
						<Input id="mv-mobile" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={11} value={mobile} disabled={verified} aria-invalid={mobile !== "" && !mobileOk} onChange={(event) => setMobile(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
						<Button type="button" variant="outline" disabled={!mobileOk || verified || send.isPending || secondsLeft > 0} onClick={() => send.mutate()}>
							{send.isPending ? t("dynamicPassword.sendingCode") : secondsLeft > 0 ? t("dynamicPassword.resendIn", {seconds: secondsLeft}) : t("dynamicPassword.sendCode")}
						</Button>
					</div>
				</div>
				{nextSendAt !== null && !verified ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="mv-code">{t("dynamicPassword.code")}</Label>
						<div className="flex items-center gap-2">
							<Input id="mv-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
							<Button type="button" variant="outline" disabled={code.length < 4 || verify.isPending} onClick={() => verify.mutate()}>
								{verify.isPending ? t("dynamicPassword.verifying") : t("dynamicPassword.verify")}
							</Button>
						</div>
					</div>
				) : null}
				{verified ? <p role="status" className="text-sm font-medium text-success">{t("dynamicPassword.verified")}</p> : null}
				{problem ? (
					<p role="alert" className="text-sm text-destructive">
						{problem}
					</p>
				) : null}
				<div>
					<Button
						type="button"
						disabled={!verified}
						onClick={() => {
							sending.reset()
							setConfirming(true)
						}}
					>
						{t("mobileVerification.register")}
					</Button>
				</div>
			</section>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("mobileVerification.confirmTitle")}
					description={t("mobileVerification.confirmQuestion")}
					summary={[{label: t("dynamicPassword.mobile"), value: <span dir="ltr">{mobile}</span>}]}
					confirmLabel={t("mobileVerification.register")}
					pendingLabel={t("dynamicPassword.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
