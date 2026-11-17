import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {disableSubUser, enableSubUser, getSubUserRules, getSubUsers, removeExistingUser, type SubUser} from "@/features/dashboard/api/sub-users"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"

const KEY = ["dashboard", "sub-users"] as const
type Kind = "disable" | "enable" | "remove"

/** The people who act on the user's accounts: see them, disable or enable a sub-user, or remove a registered user. */
export default function SubUsersPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const users = useQuery({queryKey: KEY, queryFn: getSubUsers, staleTime: 30_000, retry: false})
	const [search, setSearch] = useState("")
	const [acting, setActing] = useState<{user: SubUser; kind: Kind} | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const shown = (users.data ?? []).filter((user) => search === "" || user.username.toLowerCase().includes(search.toLowerCase()) || user.name.includes(search))
	const kindLabel = (user: SubUser): string => (user.kind === 0 ? t("dashboard.users.signatory") : user.kind === 1 ? t("dashboard.users.registered") : t("dashboard.users.subset"))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.users.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.dashboard.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.rules.back")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.users.hint")}</p>

			{notice ? (
				<Alert>
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}

			<Input className="max-w-xs" value={search} maxLength={60} placeholder={t("dashboard.users.search")} aria-label={t("dashboard.users.search")} onChange={(event) => setSearch(event.target.value)} />

			{users.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : users.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{users.error.message || t("dashboard.users.error")}
				</p>
			) : shown.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("dashboard.users.empty")}</p>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2">
					{shown.map((user) => (
						<li key={user.id} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
							<div className="flex flex-col gap-1">
								<span dir="ltr" className="text-start font-semibold">
									{user.username}
								</span>
								{user.name ? <span className="text-sm">{user.name}</span> : null}
								<span className="text-xs text-muted-foreground">
									{kindLabel(user)}
									{!user.active ? ` · ${t("dashboard.users.disabled")}` : ""}
								</span>
							</div>
							<div className="flex flex-wrap gap-2">
								{user.kind === 2 && user.active ? (
									<Button type="button" size="sm" variant="outline" onClick={() => {setRefusal(null); setActing({user, kind: "disable"})}}>
										{t("dashboard.users.disable")}
									</Button>
								) : null}
								{user.kind === 2 && !user.active ? (
									<Button type="button" size="sm" onClick={() => {setRefusal(null); setActing({user, kind: "enable"})}}>
										{t("dashboard.users.enable")}
									</Button>
								) : null}
								{user.kind === 1 && user.active ? (
									<Button type="button" size="sm" variant="destructive" onClick={() => {setRefusal(null); setActing({user, kind: "remove"})}}>
										{t("dashboard.users.remove")}
									</Button>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}

			{acting ? (
				<ActionDialog
					user={acting.user}
					kind={acting.kind}
					refusal={refusal}
					setRefusal={setRefusal}
					onClose={() => setActing(null)}
					onDone={(message) => {
						setActing(null)
						setNotice(message)
						void queryClient.invalidateQueries({queryKey: KEY})
					}}
				/>
			) : null}
		</div>
	)
}

interface DialogProps {
	user: SubUser
	kind: Kind
	refusal: string | null
	setRefusal: (message: string | null) => void
	onClose: () => void
	onDone: (message: string) => void
}

/** Confirms disabling, enabling or removing a person. Disabling or removing first checks the approval rules they belong to. Mount it only while open. */
function ActionDialog({user, kind, refusal, setRefusal, onClose, onDone}: DialogProps) {
	const {t} = useTranslation()
	const needsCheck = kind !== "enable"
	const rules = useQuery({queryKey: ["dashboard", "sub-user-rules", user.username], queryFn: () => getSubUserRules(user.username), enabled: needsCheck, retry: false, gcTime: 0})
	const blocked = needsCheck && (rules.data?.length ?? 0) > 0

	const change = useMutation({
		mutationFn: () => (kind === "disable" ? disableSubUser(user.username) : kind === "enable" ? enableSubUser(user.username) : removeExistingUser(user.username)),
		onSuccess: (message) => onDone(message || t(`dashboard.users.${kind}Done`)),
		onError: (error: Error) => setRefusal(error.message || t("dashboard.rules.failed")),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t(`dashboard.users.${kind}Title`)}
			description={blocked ? t("dashboard.users.blocked") : t(`dashboard.users.${kind}Question`)}
			summary={[
				{label: t("dashboard.users.username"), value: <span dir="ltr">{user.username}</span>},
				...(user.name ? [{label: t("dashboard.item.name"), value: user.name}] : []),
				...(blocked ? [{label: t("dashboard.users.rules"), value: (rules.data ?? []).map((rule) => rule.name).join("، ")}] : []),
			]}
			confirmLabel={t(`dashboard.users.${kind}`)}
			pendingLabel={t("dashboard.answer.sending")}
			destructive={kind === "remove"}
			canConfirm={!blocked && !(needsCheck && rules.isPending) && !(needsCheck && rules.isError)}
			pending={change.isPending}
			error={refusal ?? (needsCheck && rules.isError ? rules.error.message || t("dashboard.users.checkFailed") : null)}
			onConfirm={() => {
				setRefusal(null)
				change.mutate()
			}}
		/>
	)
}
