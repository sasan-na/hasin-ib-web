import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"

import { routeMap } from "@/app/routes"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { passwordRulesOptions } from "@/features/auth/api/password.queries"
import { PasswordInput } from "@/features/auth/components/password-input"
import { PasswordRules } from "@/features/auth/components/password-rules"
import {
	editSubUser,
	getGrantableAccounts,
	getRoles,
	getSubUserForEdit,
	type EditableSubUser,
	type GrantableAccount,
	type NewSubUserResult,
	type Role,
} from "@/features/dashboard/api/new-sub-user"
import { requestAccountCode } from "@/features/transaction/api/transaction"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { normalizeDigits } from "@/lib/normalize-digits"

// The bank's name for the check that the signed-in user owns an account (it also keys the text-message code).
const CODE_SERVICE = "Authorizer_Authenticate"
const ACCOUNT_PASSWORD_MIN = 5
const ACCOUNT_PASSWORD_MAX = 12

interface Grant {
	selected: boolean
	roleId: string
	/** Give the person a new password on an account they already have. */
	reset: boolean
	masterPassword: string
	subUserPassword: string
}

const EMPTY_GRANT: Grant = {
	selected: false,
	roleId: "",
	reset: false,
	masterPassword: "",
	subUserPassword: "",
}
const digits = (value: string): string =>
	normalizeDigits(value).replace(/\D/g, "")
const passwordOk = (value: string): boolean =>
	value.length >= ACCOUNT_PASSWORD_MIN && value.length <= ACCOUNT_PASSWORD_MAX

/** Changes a person who acts on the user's accounts: their role on each account, which accounts they have, and their passwords. */
export default function EditSubUserPage() {
	const { t } = useTranslation()
	const [params] = useSearchParams()
	const id = Number(params.get("id"))
	const valid = Number.isInteger(id) && id > 0
	const person = useQuery({
		queryKey: ["dashboard", "sub-user", id],
		queryFn: () => getSubUserForEdit(id),
		enabled: valid,
		staleTime: 0,
		gcTime: 0,
		retry: false,
	})
	const accounts = useQuery({
		queryKey: ["dashboard", "grantable"],
		queryFn: getGrantableAccounts,
		staleTime: 60_000,
		retry: false,
	})
	const roles = useQuery({
		queryKey: ["dashboard", "roles"],
		queryFn: getRoles,
		staleTime: 60_000,
		retry: false,
	})

	if (!valid || person.isError || accounts.isError || roles.isError) {
		return (
			<p
				role="alert"
				className="bg-card shadow-card text-destructive mx-auto w-full max-w-3xl rounded-2xl p-5 text-sm"
			>
				{(person.error?.message ?? "") || t("dashboard.editUser.loadError")}
			</p>
		)
	}
	if (person.isPending || accounts.isPending || roles.isPending)
		return <Skeleton className="mx-auto h-64 w-full max-w-3xl" />
	return (
		<EditForm
			key={id}
			person={person.data}
			accounts={accounts.data}
			roles={roles.data}
		/>
	)
}

function EditForm({
	person,
	accounts,
	roles,
}: {
	person: EditableSubUser
	accounts: GrantableAccount[]
	roles: Role[]
}) {
	const { t, i18n } = useTranslation()
	const passwordRules = useQuery(passwordRulesOptions(i18n.language))
	const [newPassword, setNewPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [grants, setGrants] = useState<Record<number, Grant>>(() => {
		const start: Record<number, Grant> = {}
		for (const account of accounts) {
			const current = person.accounts.find(
				(item) => item.accountNumber === account.number,
			)
			if (current)
				start[account.id] = {
					...EMPTY_GRANT,
					selected: true,
					roleId: String(current.roleId),
				}
		}
		return start
	})
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [refusal, setRefusal] = useState<string | null>(null)
	const [result, setResult] = useState<NewSubUserResult | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const hadBefore = (account: GrantableAccount): boolean =>
		person.accounts.some((item) => item.accountNumber === account.number)
	const grantOf = (account: GrantableAccount): Grant =>
		grants[account.id] ?? EMPTY_GRANT
	const patch = (account: GrantableAccount, change: Partial<Grant>): void =>
		setGrants((current) => ({
			...current,
			[account.id]: { ...(current[account.id] ?? EMPTY_GRANT), ...change },
		}))
	const chosen = accounts.filter((account) => grantOf(account).selected)
	const dropped = accounts.filter(
		(account) => hadBefore(account) && !grantOf(account).selected,
	)
	const needsPasswords = (account: GrantableAccount): boolean =>
		!hadBefore(account) || grantOf(account).reset
	const canChangePassword = !person.existing && person.isMine

	const send = useMutation({
		mutationFn: () =>
			editSubUser({
				username: person.username,
				existing: person.existing,
				newPassword,
				accounts: chosen.map((account) => ({
					accountNumber: account.number,
					masterPassword: needsPasswords(account)
						? grantOf(account).masterPassword
						: "",
					subUserPassword: needsPasswords(account)
						? grantOf(account).subUserPassword
						: "",
					roleId: Number(grantOf(account).roleId),
					passwordChanged: needsPasswords(account),
				})),
			}),
		onSuccess: (outcome) => {
			if (outcome.ok) setResult(outcome)
			else setRefusal(outcome.message || t("dashboard.editUser.failed"))
		},
		onError: (error: Error) =>
			setRefusal(error.message || t("dashboard.editUser.failed")),
	})

	const codeFor = useMutation({
		mutationFn: (account: GrantableAccount) =>
			requestAccountCode(account.number, CODE_SERVICE, 0),
	})

	const review = (): void => {
		if (newPassword !== "" || confirm !== "") {
			if (newPassword.length < 8 || newPassword.length > 35)
				return setProblem(t("dashboard.newUser.error.password"))
			if (newPassword !== confirm)
				return setProblem(t("dashboard.newUser.error.mismatch"))
		}
		if (chosen.length === 0)
			return setProblem(t("dashboard.newUser.error.accounts"))
		for (const account of chosen) {
			const grant = grantOf(account)
			if (grant.roleId === "")
				return setProblem(
					t("dashboard.newUser.error.grant", { account: account.number }),
				)
			if (
				needsPasswords(account) &&
				(!passwordOk(grant.masterPassword) ||
					!passwordOk(grant.subUserPassword))
			)
				return setProblem(
					t("dashboard.newUser.error.grant", { account: account.number }),
				)
		}
		setProblem("")
		setRefusal(null)
		setConfirming(true)
	}

	if (result) {
		return (
			<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
				<h1 className="text-2xl font-bold">
					{t("dashboard.editUser.doneTitle")}
				</h1>
				<section className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-5">
					<p className="text-sm">
						{t("dashboard.editUser.done", { username: result.username })}
					</p>
					{result.failures.length > 0 ? (
						<Alert variant="destructive">
							<AlertDescription>
								<p>{t("dashboard.editUser.someFailed")}</p>
								<ul className="mt-1 list-disc ps-5">
									{result.failures.map((failure) => (
										<li key={failure.accountNumber}>
											<span dir="ltr">{failure.accountNumber}</span>
											{failure.message ? `: ${failure.message}` : ""}
										</li>
									))}
								</ul>
							</AlertDescription>
						</Alert>
					) : null}
					<div>
						<Button asChild>
							<Link to={routeMap.subUsers.path}>
								{t("dashboard.newUser.toPeople")}
							</Link>
						</Button>
					</div>
				</section>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.editUser.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.subUsers.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.newUser.back")}
					</Link>
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">
				{t("dashboard.editUser.hint")} <span dir="ltr">{person.username}</span>
			</p>

			<FlowLayout
				aside={
					<FlowSummary
						id="eu-summary"
						title={t("dashboard.editUser.summary")}
						amount={null}
						rows={[
							{
								label: t("dashboard.newUser.username"),
								value: person.username,
							},
							{
								label: t("dashboard.editUser.newPassword"),
								value:
									newPassword !== ""
										? t("dashboard.editUser.willChange")
										: null,
							},
							{
								label: t("dashboard.newUser.accounts"),
								value: chosen.length > 0 ? String(chosen.length) : null,
							},
						]}
						reviewLabel={t("dashboard.newUser.review")}
						onReview={review}
					/>
				}
			>
				{canChangePassword ? (
					<StepSection
						id="eu-pass"
						step={1}
						title={t("dashboard.editUser.signIn")}
					>
						<p className="text-muted-foreground text-sm">
							{t("dashboard.editUser.signInHint")}
						</p>
						<div className="flex flex-col gap-2">
							<Label htmlFor="eu-new">
								{t("dashboard.editUser.newPassword")}
							</Label>
							<PasswordInput
								id="eu-new"
								autoComplete="new-password"
								maxLength={35}
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="eu-confirm">
								{t("dashboard.newUser.confirm")}
							</Label>
							<PasswordInput
								id="eu-confirm"
								autoComplete="new-password"
								maxLength={35}
								value={confirm}
								onChange={(event) => setConfirm(event.target.value)}
							/>
						</div>
						{passwordRules.data ? (
							<PasswordRules rules={passwordRules.data} violations={null} />
						) : null}
					</StepSection>
				) : null}

				<StepSection
					id="eu-accounts"
					step={canChangePassword ? 2 : 1}
					title={t("dashboard.newUser.accounts")}
				>
					{accounts.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("dashboard.newUser.noAccounts")}
						</p>
					) : roles.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("dashboard.newUser.noRoles")}
						</p>
					) : (
						<ul className="flex flex-col gap-3">
							{accounts.map((account) => {
								const grant = grantOf(account)
								return (
									<li
										key={account.id}
										className="flex flex-col gap-3 rounded-md border p-4"
									>
										<div className="flex items-center gap-2">
											<Checkbox
												id={`eu-acc-${account.id}`}
												checked={grant.selected}
												onCheckedChange={(checked) =>
													patch(account, { selected: checked === true })
												}
											/>
											<Label
												htmlFor={`eu-acc-${account.id}`}
												dir="ltr"
												className="tabular-nums"
											>
												{account.number}
											</Label>
										</div>
										{grant.selected ? (
											<div className="flex flex-col gap-3">
												<div className="flex flex-col gap-2 sm:max-w-xs">
													<Label htmlFor={`eu-role-${account.id}`}>
														{t("dashboard.newUser.role")}
													</Label>
													<Select
														value={grant.roleId}
														onValueChange={(value) =>
															patch(account, { roleId: value })
														}
													>
														<SelectTrigger
															id={`eu-role-${account.id}`}
															className="w-full"
														>
															<SelectValue
																placeholder={t("dashboard.newUser.chooseRole")}
															/>
														</SelectTrigger>
														<SelectContent>
															{roles.map((role) => (
																<SelectItem
																	key={role.id}
																	value={String(role.id)}
																>
																	{role.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												{hadBefore(account) &&
												person.isMine &&
												!person.existing ? (
													<div className="flex items-center gap-2">
														<Checkbox
															id={`eu-reset-${account.id}`}
															checked={grant.reset}
															onCheckedChange={(checked) =>
																patch(account, {
																	reset: checked === true,
																	masterPassword: "",
																	subUserPassword: "",
																})
															}
														/>
														<Label
															htmlFor={`eu-reset-${account.id}`}
															className="text-sm font-normal"
														>
															{t("dashboard.editUser.reset")}
														</Label>
													</div>
												) : null}
												{needsPasswords(account) ? (
													<div className="grid gap-3 sm:grid-cols-2">
														<div className="flex flex-col gap-2">
															<Label htmlFor={`eu-mine-${account.id}`}>
																{account.hasOtp
																	? account.otpName ||
																		t("dashboard.newUser.code")
																	: t("dashboard.newUser.mine")}
															</Label>
															<PasswordInput
																id={`eu-mine-${account.id}`}
																inputMode="numeric"
																autoComplete="off"
																maxLength={ACCOUNT_PASSWORD_MAX}
																value={grant.masterPassword}
																onChange={(event) =>
																	patch(account, {
																		masterPassword: digits(event.target.value),
																	})
																}
															/>
															{account.hasOtp ? (
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	disabled={codeFor.isPending}
																	onClick={() => codeFor.mutate(account)}
																>
																	{t("dashboard.newUser.sendCode")}
																</Button>
															) : null}
														</div>
														<div className="flex flex-col gap-2">
															<Label htmlFor={`eu-theirs-${account.id}`}>
																{t("dashboard.newUser.theirs")}
															</Label>
															<PasswordInput
																id={`eu-theirs-${account.id}`}
																inputMode="numeric"
																autoComplete="off"
																maxLength={ACCOUNT_PASSWORD_MAX}
																value={grant.subUserPassword}
																onChange={(event) =>
																	patch(account, {
																		subUserPassword: digits(event.target.value),
																	})
																}
															/>
														</div>
													</div>
												) : null}
											</div>
										) : null}
									</li>
								)
							})}
						</ul>
					)}
				</StepSection>

				{problem ? <FieldError>{problem}</FieldError> : null}
			</FlowLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("dashboard.editUser.confirmTitle")}
					description={t("dashboard.editUser.confirmQuestion")}
					summary={[
						{
							label: t("dashboard.newUser.username"),
							value: <span dir="ltr">{person.username}</span>,
						},
						...(newPassword !== ""
							? [
									{
										label: t("dashboard.editUser.newPassword"),
										value: t("dashboard.editUser.willChange"),
									},
								]
							: []),
						...chosen.map((account) => ({
							label: account.number,
							value:
								roles.find(
									(role) => String(role.id) === grantOf(account).roleId,
								)?.name ?? "",
						})),
						...dropped.map((account) => ({
							label: account.number,
							value: t("dashboard.editUser.loseAccess"),
						})),
					]}
					confirmLabel={t("dashboard.editUser.save")}
					pendingLabel={t("dashboard.answer.sending")}
					canConfirm
					pending={send.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						send.mutate()
					}}
				/>
			) : null}
		</div>
	)
}
