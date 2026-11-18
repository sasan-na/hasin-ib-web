import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {passwordRulesOptions} from "@/features/auth/api/password.queries"
import {PasswordInput} from "@/features/auth/components/password-input"
import {PasswordRules} from "@/features/auth/components/password-rules"
import {addSubUser, checkExistingUser, getGrantableAccounts, getRoles, type GrantableAccount, type NewSubUserResult} from "@/features/dashboard/api/new-sub-user"
import {getUsernameRules} from "@/features/profile/api/username"
import {requestAccountCode} from "@/features/transaction/api/transaction"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the check that the signed-in user owns an account (it also keys the text-message code).
const CODE_SERVICE = "Authorizer_Authenticate"
const ACCOUNT_PASSWORD_MIN = 5
const ACCOUNT_PASSWORD_MAX = 12

interface Grant {
	selected: boolean
	roleId: string
	masterPassword: string
	subUserPassword: string
}

const EMPTY_GRANT: Grant = {selected: false, roleId: "", masterPassword: "", subUserPassword: ""}
const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")
const passwordOk = (value: string): boolean => value.length >= ACCOUNT_PASSWORD_MIN && value.length <= ACCOUNT_PASSWORD_MAX

/** Adds a person who may act on some of the user's accounts: who they are, which accounts and in what role, then confirm. */
export default function NewSubUserPage() {
	const {t, i18n} = useTranslation()
	const accounts = useQuery({queryKey: ["dashboard", "grantable"], queryFn: getGrantableAccounts, staleTime: 60_000, retry: false})
	const roles = useQuery({queryKey: ["dashboard", "roles"], queryFn: getRoles, staleTime: 60_000, retry: false})
	const passwordRules = useQuery(passwordRulesOptions(i18n.language))
	const usernameRules = useQuery({queryKey: ["profile", "username-rules"], queryFn: getUsernameRules, staleTime: 10 * 60_000, retry: false})
	const [existing, setExisting] = useState(false)
	const [customerCode, setCustomerCode] = useState("")
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [grants, setGrants] = useState<Record<number, Grant>>({})
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [refusal, setRefusal] = useState<string | null>(null)
	const [result, setResult] = useState<NewSubUserResult | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const grantOf = (account: GrantableAccount): Grant => grants[account.id] ?? EMPTY_GRANT
	const patch = (account: GrantableAccount, change: Partial<Grant>): void => setGrants((current) => ({...current, [account.id]: {...(current[account.id] ?? EMPTY_GRANT), ...change}}))
	const chosen = (accounts.data ?? []).filter((account) => grantOf(account).selected)

	const send = useMutation({
		mutationFn: () =>
			addSubUser({
				existing,
				username: username.trim(),
				password,
				customerCode: customerCode.trim(),
				accounts: chosen.map((account) => ({accountNumber: account.number, masterPassword: grantOf(account).masterPassword, subUserPassword: grantOf(account).subUserPassword, roleId: Number(grantOf(account).roleId)})),
			}),
		onSuccess: (outcome) => {
			if (outcome.ok) setResult(outcome)
			else setRefusal(outcome.message || t("dashboard.newUser.failed"))
		},
		onError: (error: Error) => setRefusal(error.message || t("dashboard.newUser.failed")),
	})

	const codeFor = useMutation({mutationFn: (account: GrantableAccount) => requestAccountCode(account.number, CODE_SERVICE, 0)})

	const review = async (): Promise<void> => {
		if (username.trim() === "") return setProblem(t("dashboard.newUser.error.username"))
		if (existing && !/^\d{3,20}$/.test(customerCode.trim())) return setProblem(t("dashboard.newUser.error.customerCode"))
		if (password.length < 8 || password.length > 35) return setProblem(t("dashboard.newUser.error.password"))
		if (password !== confirm) return setProblem(t("dashboard.newUser.error.mismatch"))
		if (chosen.length === 0) return setProblem(t("dashboard.newUser.error.accounts"))
		for (const account of chosen) {
			const grant = grantOf(account)
			if (grant.roleId === "" || !passwordOk(grant.masterPassword) || !passwordOk(grant.subUserPassword)) return setProblem(t("dashboard.newUser.error.grant", {account: account.number}))
		}
		setProblem("")
		if (existing) {
			try {
				await checkExistingUser(username.trim(), customerCode.trim())
			} catch (error) {
				return setProblem(error instanceof Error && error.message ? error.message : t("dashboard.newUser.error.existing"))
			}
		}
		setRefusal(null)
		setConfirming(true)
	}

	if (result) {
		return (
			<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
				<h1 className="text-2xl font-bold">{t("dashboard.newUser.doneTitle")}</h1>
				<section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
					<p className="text-sm">{t("dashboard.newUser.done", {username: result.username})}</p>
					{result.accountCount ? <p className="text-sm text-muted-foreground">{t("dashboard.newUser.doneAccounts", {count: result.accountCount})}</p> : null}
					<div>
						<Button asChild>
							<Link to={routeMap.subUsers.path}>{t("dashboard.newUser.toPeople")}</Link>
						</Button>
					</div>
				</section>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.newUser.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.subUsers.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.newUser.back")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.newUser.hint")}</p>

			<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" aria-labelledby="nu-who">
				<h2 id="nu-who" className="text-base font-semibold">
					{t("dashboard.newUser.who")}
				</h2>
				<div className="flex items-center gap-2">
					<Checkbox id="nu-existing" checked={existing} onCheckedChange={(checked) => setExisting(checked === true)} />
					<Label htmlFor="nu-existing">{t("dashboard.newUser.existing")}</Label>
				</div>
				{existing ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="nu-code">{t("dashboard.newUser.customerCode")}</Label>
						<Input id="nu-code" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={20} className="max-w-60" value={customerCode} onChange={(event) => setCustomerCode(digits(event.target.value))} />
					</div>
				) : null}
				<div className="flex flex-col gap-2">
					<Label htmlFor="nu-username">{t("dashboard.newUser.username")}</Label>
					<Input id="nu-username" dir="ltr" autoComplete="off" maxLength={50} className="max-w-sm" value={username} onChange={(event) => setUsername(event.target.value)} />
					{(usernameRules.data ?? []).length > 0 ? (
						<ul className="flex list-disc flex-col gap-1 ps-5 text-xs text-muted-foreground">
							{(usernameRules.data ?? []).map((rule) => (
								<li key={rule.key}>{rule.message}</li>
							))}
						</ul>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="nu-password">{t("dashboard.newUser.password")}</Label>
					<PasswordInput id="nu-password" autoComplete="new-password" maxLength={35} value={password} onChange={(event) => setPassword(event.target.value)} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="nu-confirm">{t("dashboard.newUser.confirm")}</Label>
					<PasswordInput id="nu-confirm" autoComplete="new-password" maxLength={35} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
				</div>
				{passwordRules.data ? <PasswordRules rules={passwordRules.data} violations={null} /> : null}
			</section>

			<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" aria-labelledby="nu-accounts">
				<h2 id="nu-accounts" className="text-base font-semibold">
					{t("dashboard.newUser.accounts")}
				</h2>
				{accounts.isPending || roles.isPending ? (
					<Skeleton className="h-24 w-full" />
				) : accounts.isError || roles.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("dashboard.newUser.loadError")}
					</p>
				) : accounts.data.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("dashboard.newUser.noAccounts")}</p>
				) : roles.data.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("dashboard.newUser.noRoles")}</p>
				) : (
					<ul className="flex flex-col gap-3">
						{accounts.data.map((account) => {
							const grant = grantOf(account)
							return (
								<li key={account.id} className="flex flex-col gap-3 rounded-md border p-4">
									<div className="flex items-center gap-2">
										<Checkbox id={`nu-acc-${account.id}`} checked={grant.selected} onCheckedChange={(checked) => patch(account, {selected: checked === true})} />
										<Label htmlFor={`nu-acc-${account.id}`} dir="ltr" className="tabular-nums">
											{account.number}
										</Label>
									</div>
									{grant.selected ? (
										<div className="grid gap-3 sm:grid-cols-3">
											<div className="flex flex-col gap-2">
												<Label htmlFor={`nu-role-${account.id}`}>{t("dashboard.newUser.role")}</Label>
												<Select value={grant.roleId} onValueChange={(value) => patch(account, {roleId: value})}>
													<SelectTrigger id={`nu-role-${account.id}`} className="w-full">
														<SelectValue placeholder={t("dashboard.newUser.chooseRole")} />
													</SelectTrigger>
													<SelectContent>
														{roles.data.map((role) => (
															<SelectItem key={role.id} value={String(role.id)}>
																{role.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="flex flex-col gap-2">
												<Label htmlFor={`nu-mine-${account.id}`}>{account.hasOtp ? account.otpName || t("dashboard.newUser.code") : t("dashboard.newUser.mine")}</Label>
												<PasswordInput id={`nu-mine-${account.id}`} inputMode="numeric" autoComplete="off" maxLength={ACCOUNT_PASSWORD_MAX} value={grant.masterPassword} onChange={(event) => patch(account, {masterPassword: digits(event.target.value)})} />
												{account.hasOtp ? (
													<Button type="button" size="sm" variant="outline" disabled={codeFor.isPending} onClick={() => codeFor.mutate(account)}>
														{t("dashboard.newUser.sendCode")}
													</Button>
												) : null}
											</div>
											<div className="flex flex-col gap-2">
												<Label htmlFor={`nu-theirs-${account.id}`}>{t("dashboard.newUser.theirs")}</Label>
												<PasswordInput id={`nu-theirs-${account.id}`} inputMode="numeric" autoComplete="off" maxLength={ACCOUNT_PASSWORD_MAX} value={grant.subUserPassword} onChange={(event) => patch(account, {subUserPassword: digits(event.target.value)})} />
											</div>
										</div>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</section>

			{problem ? (
				<Alert variant="destructive">
					<AlertDescription>{problem}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button type="button" onClick={() => void review()}>
					{t("dashboard.newUser.review")}
				</Button>
			</div>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("dashboard.newUser.confirmTitle")}
					description={t("dashboard.newUser.confirmQuestion", {count: chosen.length})}
					summary={[
						{label: t("dashboard.newUser.username"), value: <span dir="ltr">{username.trim()}</span>},
						...chosen.map((account) => ({label: account.number, value: roles.data?.find((role) => String(role.id) === grantOf(account).roleId)?.name ?? ""})),
					]}
					confirmLabel={t("dashboard.newUser.add")}
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
