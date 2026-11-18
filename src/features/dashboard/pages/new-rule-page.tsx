import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useNavigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {createRule, editRule, type EditableRule, getMaximumLevel, getRuleForEdit, getRulePeople, getRuleServices, getSignatories, type MemberKept, personLabel, type RuleMember, type RulePerson} from "@/features/dashboard/api/new-rule"
import {getGrantableAccounts} from "@/features/dashboard/api/new-sub-user"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {normalizeDigits} from "@/lib/normalize-digits"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Makes or changes an approval rule: for an account and kinds of transaction, who may start one and which levels of people approve it. */
export default function NewRulePage() {
	const {t} = useTranslation()
	const [params] = useSearchParams()
	const id = Number(params.get("id"))
	const editing = Number.isInteger(id) && id > 0
	const rule = useQuery({queryKey: ["dashboard", "rule", id], queryFn: () => getRuleForEdit(id), enabled: editing, staleTime: 0, gcTime: 0, retry: false})
	if (!editing) return <RuleForm />
	if (rule.isPending) return <Skeleton className="mx-auto h-64 w-full max-w-3xl" />
	if (rule.isError) {
		return (
			<p role="alert" className="mx-auto w-full max-w-3xl rounded-lg border bg-card p-5 text-sm text-destructive">
				{rule.error.message || t("dashboard.newRule.loadRuleError")}
			</p>
		)
	}
	return <RuleForm key={id} editId={id} initial={rule.data} />
}

interface Row {
	personId: string
	min: string
	max: string
	kept?: MemberKept
}

function RuleForm({editId, initial}: {editId?: number; initial?: EditableRule}) {
	const {t, i18n} = useTranslation()
	const navigate = useNavigate()
	const isEdit = editId !== undefined
	const accounts = useQuery({queryKey: ["dashboard", "grantable"], queryFn: getGrantableAccounts, staleTime: 60_000, retry: false})
	const maxLevel = useQuery({queryKey: ["dashboard", "max-level"], queryFn: getMaximumLevel, staleTime: 10 * 60_000, retry: false})
	const [title, setTitle] = useState(initial?.title ?? "")
	const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "")
	const [serviceIds, setServiceIds] = useState<ReadonlySet<number>>(new Set(initial?.serviceIds ?? []))
	const [initiators, setInitiators] = useState<ReadonlySet<number>>(new Set(initial?.initiators.map((item) => item.person.id) ?? []))
	const initiatorKept = new Map<number, MemberKept>(initial?.initiators.map((item) => [item.person.id, item.kept]) ?? [])
	const [levels, setLevels] = useState<Row[][]>(initial && initial.levels.length > 0 ? initial.levels.map((level) => level.map((item) => ({personId: String(item.person.id), min: item.min, max: item.max, kept: item.kept}))) : [[]])
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [refusal, setRefusal] = useState<string | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const enabled = accountNumber !== ""
	const services = useQuery({queryKey: ["dashboard", "rule-services", accountNumber], queryFn: () => getRuleServices(accountNumber), enabled, staleTime: 60_000, retry: false})
	const people = useQuery({queryKey: ["dashboard", "rule-people", accountNumber], queryFn: () => getRulePeople(accountNumber), enabled, staleTime: 60_000, retry: false})
	const signatories = useQuery({queryKey: ["dashboard", "rule-signatories", accountNumber], queryFn: () => getSignatories(accountNumber), enabled, staleTime: 60_000, retry: false})
	const all = people.data ?? []
	const personById = (id: string): RulePerson | undefined => all.find((person) => String(person.id) === id)

	const members = (): RuleMember[][] => levels.map((level) => level.flatMap((item) => (personById(item.personId) ? [{person: personById(item.personId) as RulePerson, min: item.min, max: item.max, kept: item.kept}] : [])))
	// The bank stores "every transaction" as id 0; show it as everything ticked.
	const chosen: ReadonlySet<number> = serviceIds.has(0) ? new Set(services.data?.map((service) => service.id) ?? []) : serviceIds
	const allServices = (services.data?.length ?? 0) > 0 && services.data?.every((service) => chosen.has(service.id)) === true

	const save = useMutation({
		mutationFn: () => {
			const rule = {title: title.trim(), accountNumber, serviceIds: [...chosen], allServices, initiators: all.filter((person) => initiators.has(person.id)).map((person) => ({person, kept: initiatorKept.get(person.id)})), levels: members()}
			return editId === undefined ? createRule(rule) : editRule(editId, rule)
		},
		onSuccess: () => void navigate(routeMap.workflowRules.path),
		onError: (error: Error) => setRefusal(error.message || t("dashboard.newRule.failed")),
	})

	const review = (): void => {
		if (title.trim() === "") return setProblem(t("dashboard.newRule.error.title"))
		if (accountNumber === "") return setProblem(t("dashboard.newRule.error.account"))
		if (chosen.size === 0) return setProblem(t("dashboard.newRule.error.services"))
		if (initiators.size === 0) return setProblem(t("dashboard.newRule.error.initiators"))
		const filled = levels.filter((level) => level.some((item) => item.personId !== ""))
		if (filled.length === 0) return setProblem(t("dashboard.newRule.error.levels"))
		for (const level of filled) {
			for (const item of level) {
				if (item.personId === "") return setProblem(t("dashboard.newRule.error.member"))
				if (item.min !== "" && item.max !== "" && Number(item.min) > Number(item.max)) return setProblem(t("dashboard.newRule.error.range"))
			}
		}
		setLevels(filled)
		setProblem("")
		setRefusal(null)
		setConfirming(true)
	}

	const toggle = (set: ReadonlySet<number>, id: number, on: boolean): ReadonlySet<number> => {
		const next = new Set(set)
		if (on) next.add(id)
		else next.delete(id)
		return next
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{isEdit ? t("dashboard.newRule.editTitle") : t("dashboard.newRule.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.workflowRules.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.newRule.back")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.newRule.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="nr-title">{t("dashboard.newRule.name")}</Label>
					<Input id="nr-title" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="nr-account">{t("dashboard.newRule.account")}</Label>
					{accounts.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : accounts.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("dashboard.newUser.loadError")}
						</p>
					) : (
						<Select
							disabled={isEdit}
							value={accountNumber}
							onValueChange={(value) => {
								setAccountNumber(value)
								setServiceIds(new Set())
								setInitiators(new Set())
								setLevels([[]])
							}}
						>
							<SelectTrigger id="nr-account" className="w-full">
								<SelectValue placeholder={t("dashboard.newRule.chooseAccount")} />
							</SelectTrigger>
							<SelectContent>
								{accounts.data.map((account) => (
									<SelectItem key={account.id} value={account.number}>
										<span dir="ltr">{account.number}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</section>

			{enabled ? (
				<>
					<section className="flex flex-col gap-3 rounded-lg border bg-card p-5" aria-labelledby="nr-services">
						<h2 id="nr-services" className="text-base font-semibold">
							{t("dashboard.newRule.services")}
						</h2>
						{services.isPending ? (
							<Skeleton className="h-16 w-full" />
						) : services.isError ? (
							<p role="alert" className="text-sm text-destructive">
								{services.error.message || t("dashboard.newRule.loadError")}
							</p>
						) : (
							<div className="grid gap-2 sm:grid-cols-2">
								{services.data.map((service) => (
									<div key={service.id} className="flex items-center gap-2">
										<Checkbox id={`nr-s-${service.id}`} checked={chosen.has(service.id)} onCheckedChange={(checked) => setServiceIds(toggle(chosen, service.id, checked === true))} />
										<Label htmlFor={`nr-s-${service.id}`} className="text-sm font-normal">
											{service.name}
										</Label>
									</div>
								))}
							</div>
						)}
					</section>

					<section className="flex flex-col gap-3 rounded-lg border bg-card p-5" aria-labelledby="nr-initiators">
						<h2 id="nr-initiators" className="text-base font-semibold">
							{t("dashboard.newRule.initiators")}
						</h2>
						<p className="text-sm text-muted-foreground">{t("dashboard.newRule.initiatorsHint")}</p>
						{people.isPending ? (
							<Skeleton className="h-16 w-full" />
						) : all.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("dashboard.newRule.noPeople")}</p>
						) : (
							<div className="grid gap-2 sm:grid-cols-2">
								{all.map((person) => (
									<div key={person.id} className="flex items-center gap-2">
										<Checkbox id={`nr-i-${person.id}`} checked={initiators.has(person.id)} onCheckedChange={(checked) => setInitiators((current) => toggle(current, person.id, checked === true))} />
										<Label htmlFor={`nr-i-${person.id}`} className="text-sm font-normal">
											{personLabel(person)}
										</Label>
									</div>
								))}
							</div>
						)}
					</section>

					<section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="nr-levels">
						<h2 id="nr-levels" className="text-base font-semibold">
							{t("dashboard.newRule.levels")}
						</h2>
						<p className="text-sm text-muted-foreground">{t("dashboard.newRule.levelsHint")}</p>
						{levels.map((level, levelIndex) => (
							<div key={levelIndex} className="flex flex-col gap-3 rounded-md border p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">{t("dashboard.newRule.level", {number: levelIndex + 1})}</span>
									{levels.length > 1 ? (
										<Button type="button" variant="ghost" size="icon" aria-label={t("dashboard.newRule.removeLevel", {number: levelIndex + 1})} onClick={() => setLevels((current) => current.filter((_, at) => at !== levelIndex))}>
											<Trash2 aria-hidden="true" />
										</Button>
									) : null}
								</div>
								{level.map((item, itemIndex) => (
									<div key={itemIndex} className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]">
										<Select value={item.personId} onValueChange={(value) => setLevels((current) => current.map((l, li) => (li === levelIndex ? l.map((m, mi) => (mi === itemIndex ? {...m, personId: value} : m)) : l)))}>
											<SelectTrigger aria-label={t("dashboard.newRule.approver")} className="w-full">
												<SelectValue placeholder={t("dashboard.newRule.chooseApprover")} />
											</SelectTrigger>
											<SelectContent>
												{all.map((person) => (
													<SelectItem key={person.id} value={String(person.id)}>
														{personLabel(person)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Input dir="ltr" inputMode="numeric" aria-label={t("dashboard.newRule.min")} placeholder={t("dashboard.newRule.min")} value={item.min} onChange={(event) => setLevels((current) => current.map((l, li) => (li === levelIndex ? l.map((m, mi) => (mi === itemIndex ? {...m, min: digits(event.target.value)} : m)) : l)))} />
										<Input dir="ltr" inputMode="numeric" aria-label={t("dashboard.newRule.max")} placeholder={t("dashboard.newRule.max")} value={item.max} onChange={(event) => setLevels((current) => current.map((l, li) => (li === levelIndex ? l.map((m, mi) => (mi === itemIndex ? {...m, max: digits(event.target.value)} : m)) : l)))} />
										<Button type="button" variant="ghost" size="icon" aria-label={t("dashboard.newRule.removeApprover")} onClick={() => setLevels((current) => current.map((l, li) => (li === levelIndex ? l.filter((_, mi) => mi !== itemIndex) : l)))}>
											<Trash2 aria-hidden="true" />
										</Button>
									</div>
								))}
								<div>
									<Button type="button" size="sm" variant="outline" onClick={() => setLevels((current) => current.map((l, li) => (li === levelIndex ? [...l, {personId: "", min: "", max: ""}] : l)))}>
										<Plus aria-hidden="true" />
										{t("dashboard.newRule.addApprover")}
									</Button>
								</div>
							</div>
						))}
						<div>
							<Button type="button" variant="outline" disabled={levels.length >= (maxLevel.data ?? 1)} onClick={() => setLevels((current) => [...current, []])}>
								<Plus aria-hidden="true" />
								{t("dashboard.newRule.addLevel")}
							</Button>
						</div>
					</section>

					{signatories.data && signatories.data.people.length > 0 ? (
						<section className="flex flex-col gap-2 rounded-lg border bg-card p-5" aria-labelledby="nr-sign">
							<h2 id="nr-sign" className="text-base font-semibold">
								{t("dashboard.newRule.signatories")}
							</h2>
							<p className="text-sm text-muted-foreground">{t("dashboard.newRule.signatoriesHint")}</p>
							<p className="text-sm">{signatories.data.people.map(personLabel).join("، ")}</p>
							{signatories.data.hasWithdrawRule ? <p className="text-xs text-muted-foreground">{t("dashboard.newRule.withdrawRule")}</p> : null}
						</section>
					) : null}
				</>
			) : null}

			{problem ? (
				<Alert variant="destructive">
					<AlertDescription>{problem}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button type="button" disabled={!enabled} onClick={review}>
					{t("dashboard.newRule.review")}
				</Button>
			</div>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={isEdit ? t("dashboard.newRule.saveTitle") : t("dashboard.newRule.confirmTitle")}
					description={isEdit ? t("dashboard.newRule.saveQuestion") : t("dashboard.newRule.confirmQuestion")}
					summary={[
						{label: t("dashboard.newRule.name"), value: title.trim()},
						{label: t("dashboard.newRule.account"), value: <span dir="ltr">{accountNumber}</span>},
						{label: t("dashboard.newRule.services"), value: allServices ? t("dashboard.newRule.allServices") : String(chosen.size)},
						{label: t("dashboard.newRule.initiators"), value: all.filter((person) => initiators.has(person.id)).map(personLabel).join("، ")},
						...members().map((level, index) => ({label: t("dashboard.newRule.level", {number: index + 1}), value: level.map((item) => personLabel(item.person)).join("، ")})),
					]}
					confirmLabel={isEdit ? t("dashboard.newRule.save") : t("dashboard.newRule.create")}
					pendingLabel={t("dashboard.answer.sending")}
					canConfirm
					pending={save.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						save.mutate()
					}}
				/>
			) : null}
		</div>
	)
}
