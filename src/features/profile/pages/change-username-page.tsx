import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {PasswordInput} from "@/features/auth/components/password-input"
import {useSignOut} from "@/features/auth/hooks/use-sign-out"
import {changeUsername, getUsernameRules, UsernameError} from "@/features/profile/api/username"
import {useSession} from "@/store/session"

/** Changes the sign-in username. The bank ends the session afterwards, so the user signs in again with the new one. */
export default function ChangeUsernamePage() {
	const {t, i18n} = useTranslation()
	const current = useSession((s) => s.username) ?? ""
	const signOut = useSignOut()
	const rules = useQuery({queryKey: ["profile", "username-rules"], queryFn: getUsernameRules, staleTime: 10 * 60_000, retry: false})
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
	const [done, setDone] = useState(false)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const change = useMutation({
		mutationFn: () => changeUsername(username.trim(), password),
		onSuccess: () => setDone(true),
		onError: (error) => {
			if (error instanceof UsernameError && error.shouldLogOut) void signOut()
			if (error instanceof UsernameError) setBroken(new Set(error.ruleKeys))
		},
	})

	const ready = username.trim() !== "" && username.trim() !== current && password !== ""

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("profile.username.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.profile.path}>
						<BackIcon aria-hidden="true" />
						{t("profile.back")}
					</Link>
				</Button>
			</div>

			{done ? (
				<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card">
					<p className="text-sm">{t("profile.username.done", {username: username.trim()})}</p>
					<div>
						<Button type="button" onClick={() => void signOut()}>
							{t("profile.username.signInAgain")}
						</Button>
					</div>
				</section>
			) : (
				<form
					className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card"
					noValidate
					onSubmit={(event) => {
						event.preventDefault()
						if (ready) change.mutate()
					}}
				>
					<p className="text-sm text-muted-foreground">{t("profile.username.hint")}</p>
					<div className="flex flex-col gap-2">
						<Label htmlFor="cu-current">{t("profile.username.current")}</Label>
						<Input id="cu-current" dir="ltr" value={current} readOnly disabled />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="cu-new">{t("profile.username.new")}</Label>
						<Input
							id="cu-new"
							dir="ltr"
							autoComplete="off"
							maxLength={50}
							value={username}
							onChange={(event) => {
								setUsername(event.target.value)
								setBroken(new Set())
								change.reset()
							}}
						/>
					</div>
					{(rules.data ?? []).length > 0 ? (
						<ul className="flex list-disc flex-col gap-1 ps-5 text-xs text-muted-foreground">
							{(rules.data ?? []).map((rule) => (
								<li key={rule.key} className={broken.has(rule.key) ? "text-destructive" : undefined}>
									{rule.message}
								</li>
							))}
						</ul>
					) : null}
					<div className="flex flex-col gap-2">
						<Label htmlFor="cu-password">{t("profile.username.password")}</Label>
						<PasswordInput id="cu-password" autoComplete="current-password" maxLength={35} value={password} onChange={(event) => setPassword(event.target.value)} />
					</div>
					{change.isError ? (
						<Alert variant="destructive">
							<AlertDescription>{change.error.message || t("profile.username.failed")}</AlertDescription>
						</Alert>
					) : null}
					<div>
						<Button type="submit" disabled={!ready || change.isPending}>
							{change.isPending ? t("profile.username.saving") : t("profile.username.save")}
						</Button>
					</div>
				</form>
			)}
		</div>
	)
}
