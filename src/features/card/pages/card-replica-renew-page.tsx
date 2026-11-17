import {useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {renewCard, reissueCard} from "@/features/card/api/card-actions"
import {cardCredentialInfoOptions, cardInfoOptions, replicaFormOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {branchesOptions} from "@/features/transaction/api/branch.queries"
import {BranchSelect} from "@/features/transaction/components/branch-select"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

/** The bank's service name for the SMS code on card requests. */
const CODE_SERVICE = "CardAuthorize"
const MOBILE_PATTERN = /^09\d{9}$/

type Kind = "renew" | "reissue"
type Errors = Partial<Record<"branch" | "mobile" | "reason", string>>

/** Ask the bank for a new card: a renewal (the current card stops working), or a reissue of a lost or damaged one. */
export default function CardReplicaRenewPage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const cardId = Number(params.get("cardId"))
	const valid = Number.isInteger(cardId) && cardId > 0

	const card = useQuery({...cardInfoOptions(cardId), enabled: valid})
	const form = useQuery({...replicaFormOptions(i18n.language), enabled: valid})
	const branches = useQuery({...branchesOptions(i18n.language), enabled: valid})

	const [kind, setKind] = useState<Kind>("renew")
	const [branchCode, setBranchCode] = useState("")
	// Until the user types, the number the bank already has is offered.
	const [typedMobile, setTypedMobile] = useState<string | null>(null)
	const [reasonCode, setReasonCode] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [secrets, setSecrets] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery({...cardCredentialInfoOptions(cardId, i18n.language), enabled: valid && confirming})

	const mobile = typedMobile ?? form.data?.mobile ?? ""
	const cardNumber = card.data?.number ?? ""
	const reasons = form.data?.reasons ?? []
	const reason = reasons.find((candidate) => candidate.code === reasonCode)
	const branchName = branches.data?.find((branch) => branch.code === branchCode)?.name ?? branchCode
	const credentials = toCredentials(cardNumber, secrets, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			const request = {credentials, branchCode, mobile: mobile.trim()}
			if (kind === "renew") return renewCard(request)
			if (!reason) throw new Error("form incomplete")
			return reissueCard({...request, reason: reason.code})
		},
		again: {to: routeMap.cardList.path, label: t("card.replica.backToCards")},
		failedText: t("card.replica.failed"),
		uncertainText: t("card.replica.uncertain"),
	})

	if (!valid) return <Navigate to={routeMap.cardList.path} replace />
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const review = (): void => {
		const found: Errors = {}
		if (branchCode === "") found.branch = t("card.replica.error.branch")
		if (!MOBILE_PATTERN.test(mobile.trim())) found.mobile = t("card.replica.error.mobile")
		if (kind === "reissue" && !reason) found.reason = t("card.replica.error.reason")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setSecrets(EMPTY_CREDENTIALS)
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("card.replica.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.cardList.path}>
						<BackIcon aria-hidden="true" />
						{t("card.info.back")}
					</Link>
				</Button>
			</div>

			<div className="flex flex-col gap-2 rounded-lg border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
				<p>{t("card.replica.note1")}</p>
				<p>{t("card.replica.note2")}</p>
			</div>

			<section aria-label={t("card.replica.title")} className="flex flex-col gap-5 rounded-lg border bg-card p-5">
				{card.isPending ? (
					<Skeleton className="h-6 w-1/2" />
				) : (
					<p className="text-sm">
						<span className="text-muted-foreground">{t("card.number")} </span>
						<span dir="ltr" className="tabular-nums">
							{formatCardNumber(cardNumber)}
						</span>
					</p>
				)}

				<RadioGroup value={kind} onValueChange={(value) => setKind(value as Kind)} aria-label={t("card.replica.requestType")} className="flex flex-col gap-3">
					<div className="flex items-center gap-3">
						<RadioGroupItem id="kind-renew" value="renew" />
						<Label htmlFor="kind-renew">{t("card.replica.renew")}</Label>
					</div>
					<div className="flex items-center gap-3">
						<RadioGroupItem id="kind-reissue" value="reissue" />
						<Label htmlFor="kind-reissue">{t("card.replica.reissue")}</Label>
					</div>
				</RadioGroup>

				{kind === "reissue" ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="replica-reason">{t("card.replica.reason")}</Label>
						{form.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select
								value={reasonCode}
								onValueChange={(value) => {
									setReasonCode(value)
									setErrors({})
								}}
							>
								<SelectTrigger id="replica-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
									<SelectValue placeholder={t("card.replica.chooseReason")} />
								</SelectTrigger>
								<SelectContent>
									{reasons.map((candidate) => (
										<SelectItem key={candidate.code} value={candidate.code}>
											{candidate.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{errors.reason ? (
							<p role="alert" className="text-sm text-destructive">
								{errors.reason}
							</p>
						) : null}
					</div>
				) : null}

				<div className="flex flex-col gap-2">
					<Label htmlFor="replica-branch">{t("card.replica.branch")}</Label>
					<BranchSelect
						id="replica-branch"
						value={branchCode}
						onChange={(code) => {
							setBranchCode(code)
							setErrors({})
						}}
						invalid={errors.branch !== undefined}
					/>
					<p className="text-sm text-muted-foreground">{t("card.replica.branchHint")}</p>
					{errors.branch ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.branch}
						</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="replica-mobile">{t("card.replica.mobile")}</Label>
					<Input
						id="replica-mobile"
						dir="ltr"
						inputMode="numeric"
						autoComplete="tel"
						maxLength={11}
						className="max-w-64"
						value={mobile}
						aria-invalid={errors.mobile !== undefined}
						onChange={(event) => {
							setTypedMobile(normalizeDigits(event.target.value).replace(/\D/g, ""))
							setErrors({})
						}}
					/>
					{errors.mobile ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.mobile}
						</p>
					) : null}
				</div>

				<div>
					<Button type="button" disabled={card.isPending || form.isPending} onClick={review}>
						{t("card.replica.review")}
					</Button>
				</div>
			</section>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						// What was typed for the card does not outlive the dialog.
						setSecrets(EMPTY_CREDENTIALS)
						setConfirming(false)
					}}
					title={t("card.replica.confirmTitle")}
					description={t("card.replica.confirmWarning")}
					summary={[
						{label: t("card.number"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
						{label: t("card.replica.requestType"), value: kind === "renew" ? t("card.replica.renew") : t("card.replica.reissue")},
						...(kind === "reissue" && reason ? [{label: t("card.replica.reason"), value: reason.title}] : []),
						{label: t("card.replica.branch"), value: branchName},
						{label: t("card.replica.mobile"), value: <span dir="ltr">{mobile}</span>},
					]}
					confirmLabel={t("card.replica.confirm")}
					pendingLabel={t("card.replica.sending")}
					canConfirm={isCredentialsComplete(secrets, info.data) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={secrets} onChange={setSecrets} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
