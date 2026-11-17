import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useEffect, useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {Skeleton} from "@/components/ui/skeleton"
import {blockSecondPassword, getDynamicPasswordCards, registerToken, sendPhoneCode, verifyPhoneCode, type DynamicPasswordCard, type TokenType} from "@/features/card/api/dynamic-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const KEY = ["dynamic-password", "cards"] as const
const RESEND_SECONDS = 120

/** The user's cards and their one-time-password tokens: give a card a token, or block its second password. */
export default function DynamicPasswordPage() {
	const {t} = useTranslation()
	const cards = useQuery({queryKey: KEY, queryFn: getDynamicPasswordCards, staleTime: 60_000, retry: false})
	const [search, setSearch] = useState("")
	const [acting, setActing] = useState<{card: DynamicPasswordCard; kind: "allocate" | "block"} | null>(null)
	const shown = (cards.data ?? []).filter((card) => search === "" || card.cardNumber.includes(search))

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("dynamicPassword.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("dynamicPassword.hint")}</p>
			<Input className="max-w-xs" dir="ltr" inputMode="numeric" autoComplete="off" placeholder={t("dynamicPassword.search")} aria-label={t("dynamicPassword.search")} value={search} onChange={(event) => setSearch(normalizeDigits(event.target.value).replace(/\D/g, ""))} />

			{cards.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : cards.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{cards.error.message || t("dynamicPassword.error")}
				</p>
			) : shown.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("dynamicPassword.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{shown.map((card) => (
						<li key={card.cardNumber} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
							<h2 dir="ltr" className="text-start text-base font-semibold tabular-nums">
								{formatCardNumber(card.cardNumber)}
							</h2>
							<dl className="grid gap-1 text-sm sm:grid-cols-2">
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("dynamicPassword.token")}:</dt>
									<dd dir="ltr">{card.tokenSerial || t("dynamicPassword.noToken")}</dd>
								</div>
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("dynamicPassword.type")}:</dt>
									<dd>{card.tokenType === "SFT" ? t("dynamicPassword.app") : card.tokenType === "SMS" ? t("dynamicPassword.sms") : card.tokenType || t("dynamicPassword.noToken")}</dd>
								</div>
							</dl>
							{card.secondPasswordActive ? (
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" variant="outline" onClick={() => setActing({card, kind: "allocate"})}>
										{t("dynamicPassword.allocate")}
									</Button>
									<Button type="button" size="sm" variant="destructive" onClick={() => setActing({card, kind: "block"})}>
										{t("dynamicPassword.block")}
									</Button>
								</div>
							) : (
								<div className="flex flex-col gap-1 text-sm text-muted-foreground">
									<p>{t("dynamicPassword.blocked")}</p>
									<p>{t("dynamicPassword.visitBranch")}</p>
								</div>
							)}
						</li>
					))}
				</ul>
			)}

			{acting?.kind === "allocate" ? <AllocateDialog card={acting.card} onClose={() => setActing(null)} /> : null}
			{acting?.kind === "block" ? <BlockDialog card={acting.card} onClose={() => setActing(null)} /> : null}
		</div>
	)
}

function BlockDialog({card, onClose}: {card: DynamicPasswordCard; onClose: () => void}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const sending = useSubmitTransaction({
		run: () => blockSecondPassword(card.cardNumber),
		again: {to: routeMap.dynamicPassword.path, label: t("dynamicPassword.again")},
		failedText: t("dynamicPassword.failed"),
		uncertainText: t("dynamicPassword.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: KEY}),
	})
	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("dynamicPassword.blockTitle")}
			description={t("dynamicPassword.blockQuestion")}
			summary={[{label: t("dynamicPassword.card"), value: <span dir="ltr">{formatCardNumber(card.cardNumber)}</span>}]}
			confirmLabel={t("dynamicPassword.block")}
			pendingLabel={t("dynamicPassword.sending")}
			destructive
			canConfirm={!sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		/>
	)
}

/** Gives a card a token: verify a mobile number with a texted code, then register the token for it. Mount it only while open. */
function AllocateDialog({card, onClose}: {card: DynamicPasswordCard; onClose: () => void}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [mobile, setMobile] = useState("")
	const [code, setCode] = useState("")
	const [type, setType] = useState<TokenType>(card.tokenType === "SFT" ? "SFT" : "SMS")
	const [verified, setVerified] = useState(false)
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
			return registerToken(card.cardNumber, mobile, type)
		},
		again: {to: routeMap.dynamicPassword.path, label: t("dynamicPassword.again")},
		failedText: t("dynamicPassword.failed"),
		uncertainText: t("dynamicPassword.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: KEY}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("dynamicPassword.allocateTitle")}
			description={t("dynamicPassword.allocateQuestion")}
			summary={[
				{label: t("dynamicPassword.card"), value: <span dir="ltr">{formatCardNumber(card.cardNumber)}</span>},
				...(verified ? [{label: t("dynamicPassword.mobile"), value: <span dir="ltr">{mobile}</span>}] : []),
			]}
			confirmLabel={t("dynamicPassword.allocate")}
			pendingLabel={t("dynamicPassword.sending")}
			canConfirm={verified && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="dp-mobile">{t("dynamicPassword.mobile")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="dp-mobile"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={11}
							value={mobile}
							disabled={verified || sending.pending}
							aria-invalid={mobile !== "" && !mobileOk}
							onChange={(event) => setMobile(normalizeDigits(event.target.value).replace(/\D/g, ""))}
						/>
						<Button type="button" variant="outline" disabled={!mobileOk || verified || send.isPending || secondsLeft > 0} onClick={() => send.mutate()}>
							{send.isPending ? t("dynamicPassword.sendingCode") : secondsLeft > 0 ? t("dynamicPassword.resendIn", {seconds: secondsLeft}) : t("dynamicPassword.sendCode")}
						</Button>
					</div>
				</div>
				{nextSendAt !== null && !verified ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="dp-code">{t("dynamicPassword.code")}</Label>
						<div className="flex items-center gap-2">
							<Input id="dp-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
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
				{verified ? (
					<RadioGroup value={type} onValueChange={(value) => setType(value as TokenType)} className="flex flex-col gap-2" disabled={sending.pending}>
						<div className="flex items-center gap-2">
							<RadioGroupItem id="dp-sms" value="SMS" />
							<Label htmlFor="dp-sms">{t("dynamicPassword.sms")}</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem id="dp-sft" value="SFT" />
							<Label htmlFor="dp-sft">{t("dynamicPassword.app")}</Label>
						</div>
					</RadioGroup>
				) : null}
			</div>
		</ConfirmDialog>
	)
}
