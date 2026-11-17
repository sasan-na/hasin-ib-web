import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
	DashboardState,
	HistoryItem,
	WorkflowItem,
} from "@/features/dashboard/api/dashboard"
import {
	currentOptions,
	currentStatesOptions,
	historyOptions,
	historyStatesOptions,
} from "@/features/dashboard/api/dashboard.queries"
import { AnswerDialog } from "@/features/dashboard/components/answer-dialog"
import {
	ProgressDialog,
	TransactionDetailsDialog,
} from "@/features/dashboard/components/workflow-dialogs"

type Tab = "current" | "history"

/** Filter chips: every state is on until the user turns one off (an empty choice would ask the bank for nothing). */
function StateFilter({
	states,
	off,
	onToggle,
}: {
	states: DashboardState[]
	off: number[]
	onToggle: (key: number) => void
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{states.map((state) => {
				const active = !off.includes(state.key)
				return (
					<Button
						key={state.key}
						type="button"
						size="sm"
						variant={active ? "default" : "outline"}
						aria-pressed={active}
						onClick={() => onToggle(state.key)}
					>
						{state.title}
					</Button>
				)
			})}
		</div>
	)
}

/** Items that need the user's answer, and the history of those that finished. Accepting or rejecting asks for the account's password. */
export default function DashboardPage() {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>("current")
	const [titleText, setTitleText] = useState("")
	const [title, setTitle] = useState("")
	const [offCurrent, setOffCurrent] = useState<number[]>([])
	const [offHistory, setOffHistory] = useState<number[]>([])
	const [details, setDetails] = useState<WorkflowItem | null>(null)
	const [progress, setProgress] = useState<{ id: number; name: string } | null>(
		null,
	)
	const [answering, setAnswering] = useState<{
		item: WorkflowItem
		accept: boolean
	} | null>(null)
	const [notice, setNotice] = useState<string | null>(null)

	const currentStates = useQuery(currentStatesOptions())
	const historyStates = useQuery(historyStatesOptions())
	const currentKeys = (currentStates.data ?? [])
		.map((state) => state.key)
		.filter((key) => !offCurrent.includes(key))
	const historyKeys = (historyStates.data ?? [])
		.map((state) => state.key)
		.filter((key) => !offHistory.includes(key))

	const current = useInfiniteQuery(
		currentOptions(
			{ title, states: currentKeys },
			tab === "current" && currentStates.isSuccess,
		),
	)
	const history = useInfiniteQuery(
		historyOptions(
			{ title, states: historyKeys },
			tab === "history" && historyStates.isSuccess,
		),
	)

	const toggle = (
		list: number[],
		set: (next: number[]) => void,
		key: number,
	): void =>
		set(
			list.includes(key) ? list.filter((item) => item !== key) : [...list, key],
		)
	const active = tab === "current" ? current : history
	const pages: {items: (WorkflowItem | HistoryItem)[]}[] = active.data?.pages ?? []
	const items = pages.flatMap((page) => page.items)

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
			</div>
			<p className="text-muted-foreground text-sm">{t("dashboard.hint")}</p>

			{notice ? (
				<Alert>
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}

			<Tabs
				value={tab}
				onValueChange={(value) => {
					setTab(value as Tab)
					setNotice(null)
				}}
			>
				<TabsList>
					<TabsTrigger value="current">{t("dashboard.current")}</TabsTrigger>
					<TabsTrigger value="history">{t("dashboard.history")}</TabsTrigger>
				</TabsList>
			</Tabs>

			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					setTitle(titleText.trim())
				}}
			>
				<Input
					className="max-w-xs"
					value={titleText}
					maxLength={100}
					placeholder={t("dashboard.searchPlaceholder")}
					aria-label={t("dashboard.searchPlaceholder")}
					onChange={(event) => setTitleText(event.target.value)}
				/>
				<Button type="submit" variant="outline" size="sm">
					{t("dashboard.search")}
				</Button>
				{title !== "" ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							setTitleText("")
							setTitle("")
						}}
					>
						{t("dashboard.clear")}
					</Button>
				) : null}
			</form>

			{tab === "current" ? (
				<StateFilter
					states={currentStates.data ?? []}
					off={offCurrent}
					onToggle={(key) => toggle(offCurrent, setOffCurrent, key)}
				/>
			) : (
				<StateFilter
					states={historyStates.data ?? []}
					off={offHistory}
					onToggle={(key) => toggle(offHistory, setOffHistory, key)}
				/>
			)}

			{active.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-28 w-full" />
					<Skeleton className="h-28 w-full" />
				</div>
			) : active.isError ? (
				<p
					role="alert"
					className="bg-card text-destructive rounded-lg border p-5 text-sm"
				>
					{active.error.message || t("dashboard.error")}
				</p>
			) : items.length === 0 ? (
				<p className="bg-card text-muted-foreground rounded-lg border p-5 text-sm">
					{tab === "current"
						? t("dashboard.emptyCurrent")
						: t("dashboard.emptyHistory")}
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{tab === "current"
						? (items as WorkflowItem[]).map((item) => (
								<li
									key={item.id}
									className="bg-card flex flex-col gap-3 rounded-lg border p-5"
								>
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<h2 className="text-base font-semibold">
											{item.name || item.serviceName}
										</h2>
										<span className="text-muted-foreground text-xs">
											{item.isView
												? t("dashboard.item.viewOnly")
												: item.isSign
													? t("dashboard.item.waitingSign")
													: t("dashboard.item.waitingAccept")}
										</span>
									</div>
									<dl className="grid gap-1 text-sm sm:grid-cols-2">
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.service")}:
											</dt>
											<dd>{item.serviceName}</dd>
										</div>
										{item.accountNumber ? (
											<div className="flex gap-2">
												<dt className="text-muted-foreground">
													{t("dashboard.item.account")}:
												</dt>
												<dd dir="ltr">{item.accountNumber}</dd>
											</div>
										) : null}
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.initiator")}:
											</dt>
											<dd>{item.initiator}</dd>
										</div>
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.date")}:
											</dt>
											<dd dir="ltr">{item.date}</dd>
										</div>
										{item.levelName ? (
											<div className="flex gap-2">
												<dt className="text-muted-foreground">
													{t("dashboard.item.level")}:
												</dt>
												<dd>
													{item.levelName}
													{item.levelUsers.length > 0
														? ` (${item.levelUsers.map((user) => user.name).join("، ")})`
														: ""}
												</dd>
											</div>
										) : null}
									</dl>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => setDetails(item)}
										>
											{t("dashboard.item.details")}
										</Button>
										{!item.hideProgress ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() =>
													setProgress({
														id: item.id,
														name: item.name || item.serviceName,
													})
												}
											>
												{t("dashboard.item.progress")}
											</Button>
										) : null}
										{!item.isView && !item.isSign ? (
											<Button
												type="button"
												size="sm"
												onClick={() => setAnswering({ item, accept: true })}
											>
												{t("dashboard.answer.accept")}
											</Button>
										) : null}
										{!item.isView ? (
											<Button
												type="button"
												size="sm"
												variant="destructive"
												onClick={() => setAnswering({ item, accept: false })}
											>
												{t("dashboard.answer.reject")}
											</Button>
										) : null}
									</div>
									{!item.isView && item.isSign ? (
										<p className="text-muted-foreground text-xs">
											{t("dashboard.item.signNote")}
										</p>
									) : null}
								</li>
							))
						: (items as HistoryItem[]).map((item) => (
								<li
									key={item.id}
									className="bg-card flex flex-col gap-3 rounded-lg border p-5"
								>
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<h2 className="text-base font-semibold">
											{item.name || item.serviceName}
										</h2>
										<span
											className={
												item.successful
													? "text-xs font-medium text-green-600 dark:text-green-400"
													: "text-destructive text-xs font-medium"
											}
										>
											{item.successful
												? t("dashboard.item.successful")
												: t("dashboard.item.failed")}
										</span>
									</div>
									<dl className="grid gap-1 text-sm sm:grid-cols-2">
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.service")}:
											</dt>
											<dd>{item.serviceName}</dd>
										</div>
										{item.accountNumber ? (
											<div className="flex gap-2">
												<dt className="text-muted-foreground">
													{t("dashboard.item.account")}:
												</dt>
												<dd dir="ltr">{item.accountNumber}</dd>
											</div>
										) : null}
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.initiator")}:
											</dt>
											<dd>{item.initiator}</dd>
										</div>
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.started")}:
											</dt>
											<dd dir="ltr">{item.started}</dd>
										</div>
										<div className="flex gap-2">
											<dt className="text-muted-foreground">
												{t("dashboard.item.ended")}:
											</dt>
											<dd dir="ltr">{item.ended}</dd>
										</div>
									</dl>
									<div>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() =>
												setProgress({
													id: item.id,
													name: item.name || item.serviceName,
												})
											}
										>
											{t("dashboard.item.progress")}
										</Button>
									</div>
								</li>
							))}
				</ul>
			)}

			{active.hasNextPage ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						disabled={active.isFetchingNextPage}
						onClick={() => void active.fetchNextPage()}
					>
						{active.isFetchingNextPage
							? t("dashboard.loadingMore")
							: t("dashboard.loadMore")}
					</Button>
				</div>
			) : null}

			{details ? (
				<TransactionDetailsDialog
					workflowRunId={details.id}
					serviceKey={details.serviceKey}
					title={details.name || details.serviceName}
					onClose={() => setDetails(null)}
				/>
			) : null}
			{progress ? (
				<ProgressDialog
					workflowRunId={progress.id}
					title={progress.name}
					onClose={() => setProgress(null)}
				/>
			) : null}
			{answering ? (
				<AnswerDialog
					item={answering.item}
					accept={answering.accept}
					onClose={() => setAnswering(null)}
					onDone={(accepted) => {
						setAnswering(null)
						setNotice(
							accepted
								? t("dashboard.answer.accepted")
								: t("dashboard.answer.rejected"),
						)
					}}
				/>
			) : null}
		</div>
	)
}
