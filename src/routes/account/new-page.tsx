import {useMutation, useQuery} from "@tanstack/react-query"
import {useEffect, useMemo, useState} from "react"
import {useTranslation} from "react-i18next"
import {useNavigate} from "react-router-dom"

import {BranchSelect} from "@/components/transaction/branch-select"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/components/transaction/account-password"
import {ConfirmDialog} from "@/components/transaction/confirm-dialog"
import {SourceAccountSelect} from "@/components/transaction/source-account-select"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {openAccount, type AccountProfile} from "@/lib/api/openAccount"
import {accountProfilesOptions, branchesOptions, depositTypesOptions, personalInfoOptions} from "@/lib/api/openAccount.queries"
import type {SourceAccount} from "@/lib/api/transaction"
import {normalizeDigits} from "@/lib/auth/normalizeDigits"
import {formatAmount} from "@/lib/format"
import {routeMap} from "@/routing.tsx"

import type {TransactionResultState} from "../transaction-result"

// The bank's service names for this flow: which accounts may pay, which limits apply, and what it calls the SMS code.
const SOURCE_SERVICE = "OpenAccount"
const CODE_SERVICE = "OpeningAccount"

const AMOUNT_MAX_DIGITS = 13
const MOBILE_PATTERN = /^09\d{9}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormState {
	depositType: number | null
	profileCode: string
	usageId: string
	amount: string
	mobile: string
	email: string
	cardExport: boolean
	source: SourceAccount | null
	branchCode: string
}

const EMPTY: FormState = {depositType: null, profileCode: "", usageId: "", amount: "", mobile: "", email: "", cardExport: false, source: null, branchCode: ""}

type Errors = Partial<Record<"depositType" | "profile" | "usage" | "amount" | "mobile" | "email" | "source" | "branch", string>>

function Section({step, title, children}: {step: number; title: string; children: React.ReactNode}) {
	return (
		<section aria-labelledby={`step-${step}`} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
			<h2 id={`step-${step}`} className="flex items-center gap-3 text-base font-semibold">
				{/* A real sequence, so the numbers carry meaning. */}
				<span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
					{step}
				</span>
				{title}
			</h2>
			{children}
		</section>
	)
}

function Field({id, label, error, children}: {id: string; label: string; error?: string; children: React.ReactNode}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	)
}

/** Open a new account: pick the kind, fund it from one of your accounts, confirm with that account's password. */
export default function OpenAccountPage() {
	const {t, i18n} = useTranslation()
	const navigate = useNavigate()
	const [form, setForm] = useState<FormState>(EMPTY)
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")
	const [refusal, setRefusal] = useState<string | null>(null)
	// After a network failure the request may have reached the bank: no second confirm until the user has looked.
	const [uncertain, setUncertain] = useState(false)

	const types = useQuery(depositTypesOptions(i18n.language))
	const profiles = useQuery({...accountProfilesOptions(form.depositType ?? 0, i18n.language), enabled: form.depositType !== null})
	const personalInfo = useQuery(personalInfoOptions())
	const branches = useQuery(branchesOptions(i18n.language))

	// Prefill what the bank already knows, once, without overwriting anything the user has typed.
	useEffect(() => {
		if (!personalInfo.data) return
		const {mobile, email} = personalInfo.data
		// eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from loaded data
		setForm((current) => ({...current, mobile: current.mobile || mobile, email: current.email || email}))
	}, [personalInfo.data])

	const profile: AccountProfile | undefined = profiles.data?.find((candidate) => candidate.code === form.profileCode)
	const amount = form.amount === "" ? 0 : Number(form.amount)
	const requirement = usePasswordRequirement({accountId: confirming ? (form.source?.id ?? null) : null, limitServiceName: SOURCE_SERVICE, amount})

	const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
		setForm((current) => ({...current, [key]: value}))
		setErrors({})
	}

	const send = useMutation({
		mutationFn: () => {
			if (!profile || !form.source || requirement.state !== "ready") throw new Error("form incomplete")
			return openAccount({
				sourceAccountNumber: form.source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				startAmount: amount,
				productCode: profile.code,
				usageId: Number(form.usageId),
				branchCode: form.branchCode,
				cardExport: form.cardExport,
				email: form.email.trim(),
				mobile: form.mobile.trim(),
				stampFee: profile.stampFee,
			})
		},
		onSuccess: (result) => {
			// A refusal before anything was recorded stays in the dialog so it can be fixed; anything with a
			// reference number, or a success, is a real outcome and goes to the result page.
			if (!result.ok && result.transactionId === null) {
				setRefusal(result.message || t("account.new.failed"))
				return
			}
			const state: TransactionResultState = {result, again: {to: routeMap.accountNew.path, label: t("account.new.openAnother")}}
			void navigate(routeMap.transactionResult.path, {state, replace: true})
		},
		// The request may have reached the bank, so the user is told to look before trying again.
		onError: () => {
			setRefusal(t("account.new.uncertain"))
			setUncertain(true)
		},
	})

	const validate = (): Errors => {
		const found: Errors = {}
		if (form.depositType === null) found.depositType = t("account.new.error.depositType")
		if (!profile) found.profile = t("account.new.error.profile")
		if (form.usageId === "") found.usage = t("account.new.error.usage")
		if (form.amount === "" || amount <= 0) found.amount = t("account.new.error.amount")
		else if (profile && amount < profile.minBalance) found.amount = t("account.new.error.minAmount", {min: formatAmount(profile.minBalance, i18n.language)})
		if (!MOBILE_PATTERN.test(form.mobile.trim())) found.mobile = t("account.new.error.mobile")
		if (form.email.trim() !== "" && !EMAIL_PATTERN.test(form.email.trim())) found.email = t("account.new.error.email")
		if (!form.source) found.source = t("account.new.error.source")
		if (form.branchCode === "") found.branch = t("account.new.error.branch")
		return found
	}

	const review = (): void => {
		const found = validate()
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setPassword("")
		setRefusal(null)
		setUncertain(false)
		setConfirming(true)
	}

	const branchName = useMemo(() => branches.data?.find((branch) => branch.code === form.branchCode)?.name ?? form.branchCode, [branches.data, form.branchCode])

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("account.new.title")}</h1>

			<Section step={1} title={t("account.new.stepType")}>
				{types.isPending ? (
					<Skeleton className="h-16 w-full" />
				) : types.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("account.new.typesError")}
					</p>
				) : (
					<RadioGroup
						value={form.depositType === null ? "" : String(form.depositType)}
						onValueChange={(value) => setForm((current) => ({...current, depositType: Number(value), profileCode: "", usageId: "", amount: ""}))}
						aria-label={t("account.new.stepType")}
					>
						{types.data.map((type) => (
							<div key={type.id} className="flex items-center gap-3">
								<RadioGroupItem id={`deposit-type-${type.id}`} value={String(type.id)} />
								<Label htmlFor={`deposit-type-${type.id}`}>{type.name}</Label>
							</div>
						))}
					</RadioGroup>
				)}
				{errors.depositType ? (
					<p role="alert" className="text-sm text-destructive">
						{errors.depositType}
					</p>
				) : null}
			</Section>

			<Section step={2} title={t("account.new.stepDetails")}>
				<Field id="profile" label={t("account.new.profile")} error={errors.profile}>
					<Select
						value={form.profileCode}
						disabled={form.depositType === null || !profiles.data}
						onValueChange={(code) => setForm((current) => ({...current, profileCode: code, usageId: "", amount: ""}))}
					>
						<SelectTrigger id="profile" className="w-full">
							<SelectValue placeholder={profiles.isPending && form.depositType !== null ? t("account.new.loading") : t("account.new.chooseProfile")} />
						</SelectTrigger>
						<SelectContent>
							{(profiles.data ?? []).map((candidate) => (
								<SelectItem key={candidate.code} value={candidate.code}>
									{candidate.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field id="usage" label={t("account.new.usage")} error={errors.usage}>
					<Select value={form.usageId} disabled={!profile} onValueChange={(value) => set("usageId", value)}>
						<SelectTrigger id="usage" className="w-full">
							<SelectValue placeholder={t("account.new.chooseUsage")} />
						</SelectTrigger>
						<SelectContent>
							{(profile?.usages ?? []).map((usage) => (
								<SelectItem key={usage.id} value={String(usage.id)}>
									{usage.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field id="amount" label={t("account.new.amount")} error={errors.amount}>
					<Input
						id="amount"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						disabled={!profile}
						value={form.amount}
						maxLength={AMOUNT_MAX_DIGITS}
						aria-invalid={errors.amount !== undefined}
						onChange={(event) => set("amount", normalizeDigits(event.target.value).replace(/\D/g, "").replace(/^0+/, ""))}
					/>
					{form.amount !== "" ? (
						<p className="text-sm text-muted-foreground">
							{formatAmount(amount, i18n.language)} {t("account.rial")}
						</p>
					) : null}
				</Field>

				{profile ? (
					<div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4 text-sm">
						<h3 className="font-semibold">{t("account.new.profileDetails")}</h3>
						<dl className="grid gap-2 sm:grid-cols-2">
							<div className="flex flex-col">
								<dt className="text-muted-foreground">{t("account.new.minAmountLabel")}</dt>
								<dd>
									{formatAmount(profile.minBalance, i18n.language)} {t("account.rial")}
								</dd>
							</div>
							<div className="flex flex-col">
								<dt className="text-muted-foreground">{t("account.new.stampFee")}</dt>
								<dd>
									{formatAmount(profile.stampFee, i18n.language)} {t("account.rial")}
								</dd>
							</div>
							<div className="flex flex-col">
								<dt className="text-muted-foreground">{t("account.new.ownerMinAge")}</dt>
								<dd>
									{formatAmount(profile.ownerMinAge, i18n.language)} {t("account.new.years")}
								</dd>
							</div>
							<div className="flex flex-col">
								<dt className="text-muted-foreground">{t("account.new.interestRate")}</dt>
								<dd>{formatAmount(profile.interestRate, i18n.language)}%</dd>
							</div>
						</dl>
						{profile.interestTiers.length > 0 ? (
							<table className="w-full text-start">
								<caption className="pb-2 text-start font-medium">{t("account.new.interestTiers")}</caption>
								<thead>
									<tr className="text-muted-foreground">
										<th className="py-1 text-start font-normal">{t("account.new.fromMonth")}</th>
										<th className="py-1 text-start font-normal">{t("account.new.toMonth")}</th>
										<th className="py-1 text-start font-normal">{t("account.new.interestRate")}</th>
									</tr>
								</thead>
								<tbody>
									{profile.interestTiers.map((tier, index) => (
										<tr key={index} className="border-t">
											<td className="py-1 tabular-nums">{formatAmount(tier.fromMonth, i18n.language)}</td>
											<td className="py-1 tabular-nums">{formatAmount(tier.toMonth, i18n.language)}</td>
											<td className="py-1 tabular-nums">{tier.percentage}%</td>
										</tr>
									))}
								</tbody>
							</table>
						) : null}
					</div>
				) : null}
			</Section>

			<Section step={3} title={t("account.new.stepContact")}>
				<Field id="mobile" label={t("account.new.mobile")} error={errors.mobile}>
					<Input
						id="mobile"
						dir="ltr"
						inputMode="numeric"
						autoComplete="tel"
						maxLength={11}
						value={form.mobile}
						aria-invalid={errors.mobile !== undefined}
						onChange={(event) => set("mobile", normalizeDigits(event.target.value).replace(/\D/g, ""))}
					/>
				</Field>
				<Field id="email" label={`${t("account.new.email")} (${t("account.new.optional")})`} error={errors.email}>
					<Input
						id="email"
						type="email"
						dir="ltr"
						autoComplete="email"
						value={form.email}
						aria-invalid={errors.email !== undefined}
						onChange={(event) => set("email", event.target.value)}
					/>
				</Field>
				<div className="flex items-center gap-3">
					<Checkbox id="card-export" checked={form.cardExport} onCheckedChange={(checked) => set("cardExport", checked === true)} />
					<Label htmlFor="card-export">{t("account.new.cardExport")}</Label>
				</div>
			</Section>

			<Section step={4} title={t("account.new.stepPay")}>
				<Field id="source" label={t("account.new.source")} error={errors.source}>
					<SourceAccountSelect id="source" serviceName={SOURCE_SERVICE} value={form.source?.id ?? null} onChange={(account) => set("source", account)} invalid={errors.source !== undefined} />
				</Field>
				<Field id="branch" label={t("account.new.branch")} error={errors.branch}>
					<BranchSelect id="branch" value={form.branchCode} onChange={(code) => set("branchCode", code)} invalid={errors.branch !== undefined} />
				</Field>
			</Section>

			<div className="flex flex-wrap gap-2">
				<Button type="button" onClick={review}>
					{t("account.new.review")}
				</Button>
			</div>

			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={t("account.new.confirmTitle")}
				description={t("account.new.confirmDescription")}
				summary={[
					{label: t("account.new.profile"), value: profile?.name},
					{label: t("account.new.amount"), value: `${formatAmount(amount, i18n.language)} ${t("account.rial")}`},
					{label: t("account.new.stampFee"), value: `${formatAmount(profile?.stampFee ?? 0, i18n.language)} ${t("account.rial")}`},
					{label: t("account.new.source"), value: <span dir="ltr">{form.source?.number}</span>},
					{label: t("account.new.branch"), value: branchName},
				]}
				confirmLabel={t("account.new.confirm")}
				pendingLabel={t("account.new.opening")}
				canConfirm={isPasswordComplete(requirement, password) && !uncertain}
				pending={send.isPending}
				error={refusal}
				onConfirm={() => send.mutate()}
			>
				<AccountPassword
					requirement={requirement}
					accountNumber={form.source?.number ?? ""}
					codeServiceName={CODE_SERVICE}
					amount={amount}
					value={password}
					onChange={setPassword}
					disabled={send.isPending}
				/>
			</ConfirmDialog>
		</div>
	)
}
