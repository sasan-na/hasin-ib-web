import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {createRole, deleteRole, editRole, getPermissionGroups, getRoleDefinitions, roleNameTaken, type PermissionGroup, type RoleDefinition} from "@/features/dashboard/api/roles"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"

const KEY = ["dashboard", "role-definitions"] as const

/** The roles a person can be given on an account: what each allows, and making, changing or removing your own. */
export default function RolesPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const roles = useQuery({queryKey: KEY, queryFn: getRoleDefinitions, staleTime: 30_000, retry: false})
	const groups = useQuery({queryKey: ["dashboard", "permission-groups"], queryFn: getPermissionGroups, staleTime: 10 * 60_000, retry: false})
	const [editing, setEditing] = useState<RoleDefinition | "new" | null>(null)
	const [removing, setRemoving] = useState<RoleDefinition | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const remove = useMutation({
		mutationFn: (role: RoleDefinition) => deleteRole(role.id),
		onSuccess: () => {
			setRemoving(null)
			void queryClient.invalidateQueries({queryKey: KEY})
			void queryClient.invalidateQueries({queryKey: ["dashboard", "roles"]})
		},
		onError: (error: Error) => setRefusal(error.message || t("dashboard.roles.failed")),
	})

	const serviceNames = new Map((groups.data ?? []).flatMap((group) => group.services.map((service) => [service.id, service.name] as const)))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.roles.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button type="button" size="sm" onClick={() => setEditing("new")} disabled={!groups.isSuccess}>
						{t("dashboard.roles.new")}
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.subUsers.path}>
							<BackIcon aria-hidden="true" />
							{t("dashboard.newUser.back")}
						</Link>
					</Button>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.roles.hint")}</p>

			{roles.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : roles.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{roles.error.message || t("dashboard.roles.error")}
				</p>
			) : roles.data.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("dashboard.roles.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{roles.data.map((role) => (
						<li key={role.id} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-base font-semibold">{role.name}</h2>
								{role.isAdmin ? <span className="text-xs text-muted-foreground">{t("dashboard.roles.admin")}</span> : null}
							</div>
							<p className="text-sm text-muted-foreground">{role.serviceIds.map((id) => serviceNames.get(id)).filter(Boolean).join("، ") || t("dashboard.roles.noServices")}</p>
							{!role.isAdmin ? (
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" variant="outline" disabled={!groups.isSuccess} onClick={() => setEditing(role)}>
										{t("dashboard.roles.edit")}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="destructive"
										onClick={() => {
											setRefusal(null)
											setRemoving(role)
										}}
									>
										{t("dashboard.roles.delete")}
									</Button>
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}

			{editing && groups.data ? <RoleEditor groups={groups.data} role={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
			{removing ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setRemoving(null)
					}}
					title={t("dashboard.roles.deleteTitle")}
					description={t("dashboard.roles.deleteQuestion")}
					summary={[{label: t("dashboard.roles.name"), value: removing.name}]}
					confirmLabel={t("dashboard.roles.delete")}
					pendingLabel={t("dashboard.answer.sending")}
					destructive
					canConfirm
					pending={remove.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						remove.mutate(removing)
					}}
				/>
			) : null}
		</div>
	)
}

function RoleEditor({groups, role, onClose}: {groups: PermissionGroup[]; role: RoleDefinition | null; onClose: () => void}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [name, setName] = useState(role?.name ?? "")
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set(role?.serviceIds ?? []))
	const [problem, setProblem] = useState("")

	const save = useMutation({
		mutationFn: async () => {
			const trimmed = name.trim()
			if (await roleNameTaken(trimmed, role?.id ?? 0)) throw new Error(t("dashboard.roles.duplicate"))
			const ids = [...selected]
			if (role) await editRole(role.id, trimmed, ids)
			else await createRole(trimmed, ids)
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({queryKey: KEY})
			void queryClient.invalidateQueries({queryKey: ["dashboard", "roles"]})
			onClose()
		},
		onError: (error: Error) => setProblem(error.message || t("dashboard.roles.failed")),
	})

	const toggle = (ids: number[], on: boolean): void =>
		setSelected((current) => {
			const next = new Set(current)
			for (const id of ids) {
				if (on) next.add(id)
				else next.delete(id)
			}
			return next
		})

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !save.isPending) onClose()
			}}
		>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{role ? t("dashboard.roles.editTitle") : t("dashboard.roles.newTitle")}</DialogTitle>
					<DialogDescription>{t("dashboard.roles.editHint")}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="rl-name">{t("dashboard.roles.name")}</Label>
						<Input id="rl-name" maxLength={50} value={name} onChange={(event) => { setName(event.target.value); setProblem("") }} />
					</div>
					{groups.map((group) => {
						const ids = group.services.map((service) => service.id)
						const all = ids.length > 0 && ids.every((id) => selected.has(id))
						return (
							<fieldset key={group.id} className="flex flex-col gap-2 rounded-md border p-3">
								<div className="flex items-center gap-2">
									<Checkbox id={`rl-g-${group.id}`} checked={all} onCheckedChange={(checked) => toggle(ids, checked === true)} />
									<Label htmlFor={`rl-g-${group.id}`} className="font-semibold">
										{group.name}
									</Label>
								</div>
								<div className="grid gap-2 ps-6 sm:grid-cols-2">
									{group.services.map((service) => (
										<div key={service.id} className="flex items-center gap-2">
											<Checkbox id={`rl-s-${service.id}`} checked={selected.has(service.id)} onCheckedChange={(checked) => toggle([service.id], checked === true)} />
											<Label htmlFor={`rl-s-${service.id}`} className="text-sm font-normal">
												{service.name}
											</Label>
										</div>
									))}
								</div>
							</fieldset>
						)
					})}
					{problem ? (
						<p role="alert" className="text-sm text-destructive">
							{problem}
						</p>
					) : null}
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
						{t("dashboard.close")}
					</Button>
					<Button
						type="button"
						disabled={save.isPending || name.trim() === "" || selected.size === 0}
						onClick={() => {
							setProblem("")
							save.mutate()
						}}
					>
						{save.isPending ? t("dashboard.answer.sending") : t("dashboard.roles.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
