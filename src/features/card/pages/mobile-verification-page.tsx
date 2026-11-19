import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { routeMap } from "@/app/routes"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	sendPhoneCode,
	verifyMobileNumber,
	verifyPhoneCode,
} from "@/features/card/api/dynamic-password"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { normalizeDigits } from "@/lib/normalize-digits"

const RESEND_SECONDS = 120

/** Registers a mobile number with the bank: it texts a code, and once the code is right the number is confirmed for the user's cards. */
export default function MobileVerificationPage() {
	const { t } = useTranslation()
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
	const secondsLeft =
		nextSendAt === null ? 0 : Math.max(0, Math.ceil((nextSendAt - now) / 1000))
	const mobileOk = /^09\d{9}$/.test(mobile)

	const send = useMutation({
		mutationFn: () => sendPhoneCode(mobile),
		onSuccess: () => {
			setNextSendAt(Date.now() + RESEND_SECONDS * 1000)
			setNow(Date.now())
			setProblem(null)
		},
		onError: (error: Error) =>
			setProblem(error.message || t("dynamicPassword.codeFailed")),
	})
	const verify = useMutation({
		mutationFn: () => verifyPhoneCode(mobile, code),
		onSuccess: () => {
			setVerified(true)
			setProblem(null)
		},
		onError: (error: Error) =>
			setProblem(error.message || t("dynamicPassword.verifyFailed")),
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!verified) throw new Error("phone not verified")
			return verifyMobileNumber(mobile)
		},
		again: {
			to: routeMap.mobileVerification.path,
			label: t("mobileVerification.again"),
		},
		failedText: t("dynamicPassword.failed"),
		uncertainText: t("dynamicPassword.uncertain"),
	})

	return (
		<div>
			<FlowLayout
				title={t("mobileVerification.title")}
				aside={
					<FlowSummary
						id="mv-summary"
						title={t("mobileVerification.summary")}
						amount={null}
						rows={[
							{
								label: t("dynamicPassword.mobile"),
								value: mobileOk ? mobile : null,
							},
							{
								label: t("mobileVerification.statusLabel"),
								value: verified ? t("dynamicPassword.verified") : null,
							},
						]}
						reviewLabel={t("mobileVerification.register")}
						onReview={() => {
							if (!verified) return
							sending.reset()
							setConfirming(true)
						}}
					/>
				}
			>
				<p className="text-muted-foreground text-sm">
					{t("mobileVerification.hint")}
				</p>

				<StepSection
					id="mv-number"
					step={1}
					title={t("mobileVerification.numberStep")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="mv-mobile">{t("dynamicPassword.mobile")}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="mv-mobile"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={11}
								className="h-11 text-base"
								value={mobile}
								disabled={verified}
								aria-invalid={mobile !== "" && !mobileOk}
								onChange={(event) =>
									setMobile(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
								}
							/>
							<Button
								type="button"
								variant="outline"
								className="h-11"
								disabled={
									!mobileOk || verified || send.isPending || secondsLeft > 0
								}
								onClick={() => send.mutate()}
							>
								{send.isPending
									? t("dynamicPassword.sendingCode")
									: secondsLeft > 0
										? t("dynamicPassword.resendIn", { seconds: secondsLeft })
										: t("dynamicPassword.sendCode")}
							</Button>
						</div>
					</div>
				</StepSection>

				<StepSection
					id="mv-code-step"
					step={2}
					title={t("mobileVerification.codeStep")}
				>
					{verified ? (
						<p role="status" className="text-success text-sm font-medium">
							{t("dynamicPassword.verified")}
						</p>
					) : nextSendAt !== null ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor="mv-code">{t("dynamicPassword.code")}</Label>
							<div className="flex items-center gap-2">
								<Input
									id="mv-code"
									dir="ltr"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={8}
									className="h-11 text-base"
									value={code}
									onChange={(event) =>
										setCode(
											normalizeDigits(event.target.value).replace(/\D/g, ""),
										)
									}
								/>
								<Button
									type="button"
									variant="outline"
									className="h-11"
									disabled={code.length < 4 || verify.isPending}
									onClick={() => verify.mutate()}
								>
									{verify.isPending
										? t("dynamicPassword.verifying")
										: t("dynamicPassword.verify")}
								</Button>
							</div>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							{t("mobileVerification.codeWait")}
						</p>
					)}
					{problem ? <FieldError>{problem}</FieldError> : null}
				</StepSection>
			</FlowLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("mobileVerification.confirmTitle")}
					description={t("mobileVerification.confirmQuestion")}
					summary={[
						{
							label: t("dynamicPassword.mobile"),
							value: <span dir="ltr">{mobile}</span>,
						},
					]}
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
