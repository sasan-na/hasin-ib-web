import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
	AccountPassword,
	isPasswordComplete,
	usePasswordRequirement,
} from "@/features/transaction/components/account-password"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { SourceAccountSelect } from "@/features/transaction/components/source-account-select"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import {
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { requestDelegation } from "@/features/account/api/delegation"
import { organsOptions } from "@/features/account/api/delegation.queries"
import type { SourceAccount } from "@/features/transaction/api/transaction"
import { routeMap } from "@/app/routes"

// Any of the user's accounts may be delegated, so no service filter applies to the account list. The bank's
// SMS code and no-password rules for this request are the ones it keeps under the cheque-book service name
// (that is what the legacy page sends, and the server's templates are keyed by it).
const SOURCE_SERVICE = ""
const CODE_SERVICE = "ChequeBookRequest"
const LIMIT_SERVICE = "ChequeBookRequest"
const TERMS_URL = "/files/DelegatingAccountTermsAndConditions.pdf"

type Errors = Partial<Record<"source" | "organ" | "terms", string>>

/** Make one of your accounts delegable to an organ (a company the bank works with). */
export default function DelegateRequestPage() {
	const { t, i18n } = useTranslation()
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [organId, setOrganId] = useState("")
	const [agreed, setAgreed] = useState(false)
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const organs = useQuery(organsOptions(i18n.language))
	const organ = organs.data?.find(
		(candidate) => String(candidate.id) === organId,
	)
	// No amount is involved, so the no-password limit never applies: only the account's own password type counts.
	const requirement = usePasswordRequirement({
		accountId: confirming ? (source?.id ?? null) : null,
		limitServiceName: LIMIT_SERVICE,
		amount: 0,
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || !organ || requirement.state !== "ready")
				throw new Error("form incomplete")
			return requestDelegation({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				organId: organ.id,
			})
		},
		again: {
			to: routeMap.accountDelegate.path,
			label: t("account.delegate.again"),
		},
		failedText: t("account.delegate.failed"),
		uncertainText: t("account.delegate.uncertain"),
	})

	const review = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("account.delegate.error.source")
		if (!organ) found.organ = t("account.delegate.error.organ")
		if (!agreed) found.terms = t("account.delegate.error.terms")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("account.delegate.title")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("account.delegate.intro")}
			</p>

			<FlowLayout
				aside={
					<FlowSummary
						id="delegate-summary"
						title={t("account.delegate.summary")}
						amount={null}
						rows={[
							{
								label: t("account.number"),
								value: source ? source.number : null,
							},
							{
								label: t("account.delegate.organ"),
								value: organ ? organ.name : null,
							},
						]}
						reviewLabel={t("account.delegate.review")}
						onReview={review}
					/>
				}
			>
				<StepSection
					id="delegate-source"
					step={1}
					title={t("account.delegate.sourceTitle")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="delegate-account">{t("account.number")}</Label>
						<SourceAccountSelect
							id="delegate-account"
							serviceName={SOURCE_SERVICE}
							value={source?.id ?? null}
							onChange={(account) => {
								setSource(account)
								setErrors({})
							}}
							invalid={errors.source !== undefined}
						/>
						{errors.source ? (
							<p role="alert" className="text-destructive text-sm">
								{errors.source}
							</p>
						) : null}
					</div>
				</StepSection>

				<StepSection
					id="delegate-organ"
					step={2}
					title={t("account.delegate.organTitle")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="delegate-organ-select">
							{t("account.delegate.organ")}
						</Label>
						{organs.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : organs.isError ? (
							<p role="alert" className="text-destructive text-sm">
								{t("account.delegate.organsError")}
							</p>
						) : organs.data.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("account.delegate.noOrgans")}
							</p>
						) : (
							<Select
								value={organId}
								onValueChange={(value) => {
									setOrganId(value)
									setErrors({})
								}}
							>
								<SelectTrigger
									id="delegate-organ-select"
									className="w-full"
									aria-invalid={errors.organ !== undefined}
								>
									<SelectValue
										placeholder={t("account.delegate.chooseOrgan")}
									/>
								</SelectTrigger>
								<SelectContent>
									{organs.data.map((candidate) => (
										<SelectItem key={candidate.id} value={String(candidate.id)}>
											{candidate.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{errors.organ ? (
							<p role="alert" className="text-destructive text-sm">
								{errors.organ}
							</p>
						) : null}
					</div>
				</StepSection>

				<StepSection
					id="delegate-terms-step"
					step={3}
					title={t("account.delegate.termsStep")}
				>
					<div className="flex flex-col gap-2">
						<div className="flex items-start gap-3">
							<Checkbox
								id="delegate-terms"
								className="mt-0.5"
								checked={agreed}
								onCheckedChange={(checked) => {
									setAgreed(checked === true)
									setErrors({})
								}}
							/>
							<Label
								htmlFor="delegate-terms"
								className="flex-wrap gap-x-1 leading-relaxed font-normal"
							>
								<a
									href={TERMS_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="font-semibold underline underline-offset-4"
								>
									{t("account.delegate.termsLink")}
								</a>
								{t("account.delegate.termsAgree")}
							</Label>
						</div>
						{errors.terms ? (
							<p role="alert" className="text-destructive text-sm">
								{errors.terms}
							</p>
						) : null}
					</div>
				</StepSection>
			</FlowLayout>

			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={t("account.delegate.confirmTitle")}
				description={t("account.delegate.confirmDescription")}
				summary={[
					{
						label: t("account.number"),
						value: <span dir="ltr">{source?.number}</span>,
					},
					{ label: t("account.delegate.organ"), value: organ?.name },
				]}
				confirmLabel={t("account.delegate.confirm")}
				pendingLabel={t("account.delegate.sending")}
				canConfirm={
					isPasswordComplete(requirement, password) && !sending.blocked
				}
				pending={sending.pending}
				error={sending.refusal}
				onConfirm={sending.submit}
			>
				<AccountPassword
					requirement={requirement}
					accountNumber={source?.number ?? ""}
					codeServiceName={CODE_SERVICE}
					amount={0}
					value={password}
					onChange={setPassword}
					disabled={sending.pending}
				/>
			</ConfirmDialog>
		</div>
	)
}
