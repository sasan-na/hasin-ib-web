import {useInfiniteQuery, useMutation, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {confirmWorkflowRule, deleteWorkflowRule, getWorkflowRules, type WorkflowRule} from "@/features/dashboard/api/workflow-rules"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"

const PAGE_SIZE = 20
const KEY = ["dashboard", "rules"] as const

/** The rules that say who must approve what on the user's accounts: look at them, confirm one that needs review, or delete one. */
export default function WorkflowRulesPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [text, setText] = useState("")
	const [name, setName] = useState("")
	const [acting, setActing] = useState<{rule: WorkflowRule; kind: "delete" | "confirm"} | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const rules = useInfiniteQuery({
		queryKey: [...KEY, name],
		queryFn: ({pageParam}) => getWorkflowRules(name, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length * PAGE_SIZE : undefined),
		staleTime: 30_000,
		retry: false,
	})
	const items = rules.data?.pages.flatMap((page) => page.rules) ?? []

	const change = useMutation({
		mutationFn: (input: {rule: WorkflowRule; kind: "delete" | "confirm"}) => (input.kind === "delete" ? deleteWorkflowRule(input.rule.id) : confirmWorkflowRule(input.rule.id)),
		onSuccess: (message) => {
			setActing(null)
			setNotice(message || t("dashboard.rules.done"))
			void queryClient.invalidateQueries({queryKey: KEY})
		},
		onError: (error: Error) => setRefusal(error.message || t("dashboard.rules.failed")),
	})

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.rules.title")}</h1>
				<div className="flex flex-wrap gap-2">
				<Button asChild size="sm">
					<Link to={routeMap.newRule.path}>{t("dashboard.newRule.open")}</Link>
				</Button>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.dashboard.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.rules.back")}
					</Link>
				</Button>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.rules.hint")}</p>

			{notice ? (
				<Alert>
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}

			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					setName(text.trim())
				}}
			>
				<Input className="max-w-xs" value={text} maxLength={100} placeholder={t("dashboard.searchPlaceholder")} aria-label={t("dashboard.searchPlaceholder")} onChange={(event) => setText(event.target.value)} />
				<Button type="submit" variant="outline" size="sm">
					{t("dashboard.search")}
				</Button>
			</form>

			{rules.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : rules.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{rules.error.message || t("dashboard.rules.error")}
				</p>
			) : items.length === 0 ? (
				<p className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">{t("dashboard.rules.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{items.map((rule) => (
						<li key={rule.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-base font-semibold">{rule.name}</h2>
								{rule.needsReview ? <span className="text-xs font-medium text-warning">{t("dashboard.rules.needsReview")}</span> : null}
							</div>
							<dl className="grid gap-1 text-sm">
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("dashboard.item.account")}:</dt>
									<dd dir="ltr">
										{rule.accountNumber}
										{rule.accountName ? ` (${rule.accountName})` : ""}
									</dd>
								</div>
								{rule.services.length > 0 ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("dashboard.rules.services")}:</dt>
										<dd>{rule.services.join("، ")}</dd>
									</div>
								) : null}
								{rule.signatories.length > 0 ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("dashboard.rules.signatories")}:</dt>
										<dd>{rule.signatories.join("، ")}</dd>
									</div>
								) : null}
							</dl>
							<div className="flex flex-wrap gap-2">
								{rule.needsReview ? (
									<Button
										type="button"
										size="sm"
										onClick={() => {
											setRefusal(null)
											setActing({rule, kind: "confirm"})
										}}
									>
										{t("dashboard.rules.confirm")}
									</Button>
								) : null}
								<Button asChild size="sm" variant="outline">
									<Link to={`${routeMap.newRule.path}?id=${rule.id}`}>{t("dashboard.rules.edit")}</Link>
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									onClick={() => {
										setRefusal(null)
										setActing({rule, kind: "delete"})
									}}
								>
									{t("dashboard.rules.delete")}
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}

			{rules.hasNextPage ? (
				<div className="flex justify-center">
					<Button type="button" variant="outline" disabled={rules.isFetchingNextPage} onClick={() => void rules.fetchNextPage()}>
						{rules.isFetchingNextPage ? t("dashboard.loadingMore") : t("dashboard.loadMore")}
					</Button>
				</div>
			) : null}

			{acting ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setActing(null)
					}}
					title={acting.kind === "delete" ? t("dashboard.rules.deleteTitle") : t("dashboard.rules.confirmTitle")}
					description={acting.kind === "delete" ? t("dashboard.rules.deleteQuestion") : t("dashboard.rules.confirmQuestion")}
					summary={[
						{label: t("dashboard.item.name"), value: acting.rule.name},
						{label: t("dashboard.item.account"), value: <span dir="ltr">{acting.rule.accountNumber}</span>},
					]}
					confirmLabel={acting.kind === "delete" ? t("dashboard.rules.delete") : t("dashboard.rules.confirm")}
					pendingLabel={t("dashboard.answer.sending")}
					destructive={acting.kind === "delete"}
					canConfirm
					pending={change.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						change.mutate(acting)
					}}
				/>
			) : null}
		</div>
	)
}
