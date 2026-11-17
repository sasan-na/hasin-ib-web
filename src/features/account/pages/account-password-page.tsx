import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {changeAccountPassword, setPasswordRequired, type Gateway} from "@/features/account/api/account-password"
import {accountPasswordDetailsOptions, gatewaysOptions} from "@/features/account/api/account.queries"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's limits for an account password.
const MIN_LENGTH = 6
const MAX_LENGTH = 12

interface Outcome {
	gateway: string
	ok: boolean
	message: string
}

const validLength = (value: string): boolean => value.length >= MIN_LENGTH && value.length <= MAX_LENGTH
// Passwords may be typed with Persian digits; the bank wants the Western ones.
const clean = (value: string): string => normalizeDigits(value)

function ChangePassword({accountId, gateways}: {accountId: number; gateways: Gateway[]}) {
	const {t} = useTranslation()
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
	const [oldPassword, setOldPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [repeat, setRepeat] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [outcomes, setOutcomes] = useState<Outcome[]>([])

	const change = useMutation({
		mutationFn: async (): Promise<Outcome[]> => {
			const results: Outcome[] = []
			// One gateway at a time: each call changes the password the next one is checked against.
			for (const gateway of gateways.filter((candidate) => selected.has(candidate.key))) {
				try {
					const result = await changeAccountPassword({accountId, gateway, oldPassword: clean(oldPassword), newPassword: clean(newPassword)})
					results.push({gateway: gateway.name, ok: result.ok, message: result.message})
				} catch {
					results.push({gateway: gateway.name, ok: false, message: t("account.password.uncertain")})
				}
			}
			return results
		},
		onSuccess: (results) => {
			setOutcomes(results)
			// Never keep what was typed once the bank has answered.
			setOldPassword("")
			setNewPassword("")
			setRepeat("")
			setSelected(new Set())
		},
	})

	const submit = (): void => {
		if (selected.size === 0) return setError(t("account.password.error.gateway"))
		if (!validLength(oldPassword) || !validLength(newPassword)) return setError(t("account.password.error.length", {min: MIN_LENGTH, max: MAX_LENGTH}))
		if (newPassword === oldPassword) return setError(t("account.password.error.same"))
		if (newPassword !== repeat) return setError(t("account.password.error.mismatch"))
		setError(null)
		setOutcomes([])
		change.mutate()
	}

	const changeable = gateways.filter((gateway) => !gateway.hasToken)

	return (
		<form
			noValidate
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			{gateways.some((gateway) => gateway.hasToken) ? <p className="text-sm text-muted-foreground">{t("account.password.tokenInfo")}</p> : null}
			<fieldset className="flex flex-col gap-3">
				<legend className="mb-1 text-sm font-medium">{t("account.password.gateways")}</legend>
				{changeable.length === 0 ? <p className="text-sm text-muted-foreground">{t("account.password.noGateways")}</p> : null}
				{changeable.map((gateway) => (
					<div key={gateway.key} className="flex items-center gap-3">
						<Checkbox
							id={`gateway-${gateway.key}`}
							checked={selected.has(gateway.key)}
							disabled={change.isPending}
							onCheckedChange={(checked) => {
								const next = new Set(selected)
								if (checked === true) next.add(gateway.key)
								else next.delete(gateway.key)
								setSelected(next)
								setError(null)
							}}
						/>
						<Label htmlFor={`gateway-${gateway.key}`} className="font-normal">
							{gateway.name}
						</Label>
					</div>
				))}
			</fieldset>
			{[
				{id: "old", label: t("account.password.current"), value: oldPassword, set: setOldPassword, autoComplete: "current-password"},
				{id: "new", label: t("account.password.new"), value: newPassword, set: setNewPassword, autoComplete: "new-password"},
				{id: "repeat", label: t("account.password.repeat"), value: repeat, set: setRepeat, autoComplete: "new-password"},
			].map((field) => (
				<div key={field.id} className="flex max-w-sm flex-col gap-2">
					<Label htmlFor={`pw-${field.id}`}>{field.label}</Label>
					<Input
						id={`pw-${field.id}`}
						type="password"
						dir="ltr"
						autoComplete={field.autoComplete}
						maxLength={MAX_LENGTH}
						value={field.value}
						disabled={change.isPending}
						onChange={(event) => {
							field.set(event.target.value)
							setError(null)
						}}
					/>
				</div>
			))}
			<p className="text-xs text-muted-foreground">{t("account.password.rules", {min: MIN_LENGTH, max: MAX_LENGTH})}</p>
			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			{outcomes.length > 0 ? (
				<ul className="flex flex-col gap-1 text-sm" role="status">
					{outcomes.map((outcome) => (
						<li key={outcome.gateway} className={outcome.ok ? "text-success" : "text-destructive"}>
							{outcome.gateway}: {outcome.message || (outcome.ok ? t("account.password.changed") : t("account.password.failed"))}
						</li>
					))}
				</ul>
			) : null}
			<div>
				<Button type="submit" disabled={change.isPending}>
					{change.isPending ? t("account.password.changing") : t("account.password.change")}
				</Button>
			</div>
		</form>
	)
}

function AskPassword({accountId, asksPassword}: {accountId: number; asksPassword: boolean}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [required, setRequired] = useState(asksPassword)
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [done, setDone] = useState(false)

	const save = useMutation({
		mutationFn: () => setPasswordRequired({accountId, required, password: clean(password)}),
		onSuccess: (result) => {
			setPassword("")
			if (result.ok) {
				setDone(true)
				void queryClient.invalidateQueries({queryKey: ["account", "password"]})
			} else setError(result.message || t("account.password.failed"))
		},
		onError: () => setError(t("account.password.uncertain")),
	})

	return (
		<form
			noValidate
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault()
				if (!validLength(clean(password))) return setError(t("account.password.error.length", {min: MIN_LENGTH, max: MAX_LENGTH}))
				setError(null)
				setDone(false)
				save.mutate()
			}}
		>
			<div className="flex items-center gap-3">
				<Checkbox
					id="ask-password"
					checked={required}
					disabled={save.isPending}
					onCheckedChange={(checked) => {
						setRequired(checked === true)
						setDone(false)
						setError(null)
					}}
				/>
				<Label htmlFor="ask-password" className="font-normal">
					{t("account.password.ask")}
				</Label>
			</div>
			<div className="flex max-w-sm flex-col gap-2">
				<Label htmlFor="ask-current">{t("account.password.current")}</Label>
				<Input id="ask-current" type="password" dir="ltr" autoComplete="current-password" maxLength={MAX_LENGTH} value={password} disabled={save.isPending} onChange={(event) => setPassword(event.target.value)} />
			</div>
			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			{done ? (
				<p role="status" className="text-sm text-success">
					{t("account.password.saved")}
				</p>
			) : null}
			<div>
				<Button type="submit" disabled={save.isPending}>
					{t("account.password.save")}
				</Button>
			</div>
		</form>
	)
}

/** The account's password: change it for each way in (internet, mobile, telephone), or choose whether transactions ask for it. */
export default function AccountPasswordPage() {
	const {t} = useTranslation()
	const [params] = useSearchParams()
	const accountId = Number(params.get("accountId"))
	const valid = Number.isInteger(accountId) && accountId > 0
	const details = useQuery({...accountPasswordDetailsOptions(accountId), enabled: valid})
	const gateways = useQuery({...gatewaysOptions(accountId), enabled: valid})

	if (!valid) return <Navigate to={routeMap.accountList.path} replace />

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("account.password.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.accountList.path}>{t("account.info.back")}</Link>
				</Button>
			</div>
			{details.isPending || gateways.isPending ? (
				<Skeleton className="h-64 w-full" />
			) : details.isError || gateways.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("account.password.loadFailed")}
				</p>
			) : (
				<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
					<p className="text-sm text-muted-foreground">
						{t("account.number")}: <span dir="ltr">{details.data.number}</span>
					</p>
					<Tabs defaultValue="change">
						<TabsList>
							<TabsTrigger value="change">{t("account.password.changeTab")}</TabsTrigger>
							{details.data.usesToken ? null : <TabsTrigger value="ask">{t("account.password.askTab")}</TabsTrigger>}
						</TabsList>
						<TabsContent value="change" className="pt-4">
							<ChangePassword accountId={accountId} gateways={gateways.data} />
						</TabsContent>
						{details.data.usesToken ? null : (
							<TabsContent value="ask" className="pt-4">
								<AskPassword accountId={accountId} asksPassword={details.data.asksPassword} />
							</TabsContent>
						)}
					</Tabs>
				</section>
			)}
		</div>
	)
}
