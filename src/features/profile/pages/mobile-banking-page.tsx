import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {passwordRulesOptions} from "@/features/auth/api/password.queries"
import {PasswordInput} from "@/features/auth/components/password-input"
import {PasswordRules} from "@/features/auth/components/password-rules"
import {changeMobilePassword, getMobileInfo, MobileChangeError, setMobileNumbers, type MobileInfo} from "@/features/profile/api/mobile"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {normalizeDigits} from "@/lib/normalize-digits"

const KEY = ["profile", "mobile"] as const
// The bank accepts Iranian mobile numbers: 09 and nine more digits.
const MOBILE = /^09\d{9}$/

/** The mobile banking login: its username, the phones allowed to use it, and its password. */
export default function MobileBankingPage() {
	const {t, i18n} = useTranslation()
	const info = useQuery({queryKey: KEY, queryFn: getMobileInfo, staleTime: 60_000, retry: false})
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("profile.mobile.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.profile.path}>
						<BackIcon aria-hidden="true" />
						{t("profile.back")}
					</Link>
				</Button>
			</div>

			{info.isPending ? (
				<Skeleton className="h-48 w-full" />
			) : info.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{info.error.message || t("profile.mobile.error")}
				</p>
			) : info.data === null ? (
				<div className="flex flex-col gap-1 rounded-2xl border bg-card p-5 shadow-card text-sm">
					<p>{t("profile.mobile.inactive1")}</p>
					<p className="text-muted-foreground">{t("profile.mobile.inactive2")}</p>
				</div>
			) : (
				<>
					<section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card">
						<dl className="grid gap-3 sm:grid-cols-2">
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("profile.fields.username")}</dt>
								<dd dir="ltr" className="text-start font-medium">
									{info.data.username}
								</dd>
							</div>
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("profile.fields.password")}</dt>
								<dd className="font-medium">{info.data.hasOtp ? t("profile.oneTimeCode") : "••••••••"}</dd>
							</div>
						</dl>
					</section>
					<NumbersSection info={info.data} />
					{!info.data.hasOtp ? <PasswordSection /> : null}
				</>
			)}
		</div>
	)
}

function NumbersSection({info}: {info: MobileInfo}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [numbers, setNumbers] = useState<string[]>(info.numbers)
	const [confirming, setConfirming] = useState(false)
	const [refusal, setRefusal] = useState<string | null>(null)
	const [saved, setSaved] = useState(false)

	const filled = numbers.map((number) => number.trim()).filter((number) => number !== "")
	const unique = new Set(filled).size === filled.length
	const valid = filled.every((number) => MOBILE.test(number)) && unique
	const changed = JSON.stringify(filled) !== JSON.stringify(info.numbers)

	const save = useMutation({
		mutationFn: () => setMobileNumbers(filled),
		onSuccess: () => {
			setConfirming(false)
			setSaved(true)
			void queryClient.invalidateQueries({queryKey: KEY})
		},
		onError: (error) => setRefusal(error instanceof MobileChangeError && error.message ? error.message : t("profile.mobile.numbers.failed")),
	})

	return (
		<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" aria-labelledby="mb-numbers">
			<h2 id="mb-numbers" className="text-base font-semibold">
				{t("profile.mobile.numbers.title")}
			</h2>
			<p className="text-sm text-muted-foreground">{t("profile.mobile.numbers.hint")}</p>
			<ul className="flex flex-col gap-2">
				{numbers.map((number, index) => (
					<li key={index} className="flex items-center gap-2">
						<Input
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={11}
							aria-label={t("profile.mobile.numbers.number", {index: index + 1})}
							aria-invalid={number !== "" && !MOBILE.test(number)}
							value={number}
							onChange={(event) => {
								setSaved(false)
								setNumbers((current) => current.map((item, at) => (at === index ? normalizeDigits(event.target.value).replace(/\D/g, "") : item)))
							}}
						/>
						<Button type="button" variant="ghost" size="icon" aria-label={t("profile.mobile.numbers.remove", {index: index + 1})} onClick={() => setNumbers((current) => current.filter((_, at) => at !== index))}>
							<Trash2 aria-hidden="true" />
						</Button>
					</li>
				))}
			</ul>
			{!valid ? <p role="alert" className="text-sm text-destructive">{unique ? t("profile.mobile.numbers.invalid") : t("profile.mobile.numbers.duplicate")}</p> : null}
			{saved ? <p role="status" className="text-sm text-success">{t("profile.mobile.numbers.saved")}</p> : null}
			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="outline" onClick={() => setNumbers((current) => [...current, ""])}>
					<Plus aria-hidden="true" />
					{t("profile.mobile.numbers.add")}
				</Button>
				<Button
					type="button"
					disabled={!valid || !changed}
					onClick={() => {
						setRefusal(null)
						setConfirming(true)
					}}
				>
					{t("profile.mobile.numbers.save")}
				</Button>
			</div>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("profile.mobile.numbers.confirmTitle")}
					description={t("profile.mobile.numbers.confirmQuestion")}
					summary={filled.map((number, index) => ({label: t("profile.mobile.numbers.number", {index: index + 1}), value: <span dir="ltr">{number}</span>}))}
					confirmLabel={t("profile.mobile.numbers.save")}
					pendingLabel={t("profile.mobile.numbers.saving")}
					canConfirm
					pending={save.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						save.mutate()
					}}
				/>
			) : null}
		</section>
	)
}

function PasswordSection() {
	const {t, i18n} = useTranslation()
	const rules = useQuery(passwordRulesOptions(i18n.language))
	const [oldPassword, setOldPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [broken, setBroken] = useState<ReadonlySet<string> | null>(null)
	const [done, setDone] = useState(false)

	const change = useMutation({
		mutationFn: () => changeMobilePassword(oldPassword, newPassword),
		onSuccess: () => {
			setDone(true)
			setOldPassword("")
			setNewPassword("")
			setConfirm("")
			setBroken(null)
		},
		onError: (error) => {
			if (error instanceof MobileChangeError && error.ruleKeys.length > 0) setBroken(new Set(error.ruleKeys))
		},
	})

	const mismatch = confirm !== "" && confirm !== newPassword
	const ready = oldPassword !== "" && newPassword.length >= 8 && newPassword !== oldPassword && confirm === newPassword

	return (
		<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" aria-labelledby="mb-password">
			<h2 id="mb-password" className="text-base font-semibold">
				{t("profile.mobile.password.title")}
			</h2>
			<form
				className="flex flex-col gap-4"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					if (ready) change.mutate()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="mp-old">{t("profile.mobile.password.old")}</Label>
					<PasswordInput id="mp-old" autoComplete="current-password" maxLength={35} value={oldPassword} onChange={(event) => { setOldPassword(event.target.value); setDone(false) }} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="mp-new">{t("profile.mobile.password.new")}</Label>
					<PasswordInput id="mp-new" autoComplete="new-password" maxLength={35} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setDone(false); setBroken(null) }} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="mp-confirm">{t("profile.mobile.password.confirm")}</Label>
					<PasswordInput id="mp-confirm" autoComplete="new-password" maxLength={35} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
					{mismatch ? <p role="alert" className="text-sm text-destructive">{t("profile.mobile.password.mismatch")}</p> : null}
				</div>
				{rules.data ? <PasswordRules rules={rules.data} violations={broken} /> : null}
				{change.isError ? (
					<Alert variant="destructive">
						<AlertDescription>{change.error.message || t("profile.mobile.password.failed")}</AlertDescription>
					</Alert>
				) : null}
				{done ? <p role="status" className="text-sm text-success">{t("profile.mobile.password.done")}</p> : null}
				<div>
					<Button type="submit" disabled={!ready || change.isPending}>
						{change.isPending ? t("profile.mobile.password.saving") : t("profile.mobile.password.save")}
					</Button>
				</div>
			</form>
		</section>
	)
}
