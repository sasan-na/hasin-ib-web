import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {MailOpen, Mail, Plus, RefreshCw, Trash2} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {deleteMessage, type MessageSummary} from "@/features/message/api/message"
import {messageKeys, messagesOptions} from "@/features/message/api/message.queries"

/** The user's conversations with the bank, newest first. */
export default function MessageListPage() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const messages = useQuery(messagesOptions())
	const [toDelete, setToDelete] = React.useState<MessageSummary | null>(null)
	const [notice, setNotice] = React.useState<{ok: boolean; text: string} | null>(null)

	const remove = useMutation({
		mutationFn: (id: number) => deleteMessage(id),
		onSuccess: (result) => {
			setNotice({ok: result.ok, text: result.message || (result.ok ? t("message.deleted") : t("message.deleteFailed"))})
			setToDelete(null)
			void queryClient.invalidateQueries({queryKey: messageKeys.list})
		},
		onError: () => {
			setNotice({ok: false, text: t("message.deleteFailed")})
			setToDelete(null)
		},
	})

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("message.title")}</h1>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" disabled={messages.isFetching} onClick={() => void messages.refetch()}>
						<RefreshCw aria-hidden="true" className={messages.isFetching ? "animate-spin" : undefined} />
						{t("message.refresh")}
					</Button>
					<Button asChild size="sm">
						<Link to={routeMap.messageNew.path}>
							<Plus aria-hidden="true" />
							{t("message.newTitle")}
						</Link>
					</Button>
				</div>
			</div>

			{notice ? (
				<p role={notice.ok ? "status" : "alert"} className={`rounded-lg bg-card p-4 text-sm ${notice.ok ? "" : "text-destructive"}`}>
					{notice.text}
				</p>
			) : null}

			{messages.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : messages.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{messages.error.message || t("message.error")}
				</p>
			) : messages.data.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("message.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{messages.data.map((item) => (
						<li key={`${item.isOld ? "old" : "new"}-${String(item.id)}`} className="flex items-stretch gap-2 rounded-lg border bg-card">
							<Link
								to={`${routeMap.messageDetail.path}?id=${String(item.id)}${item.isOld ? "&old=1" : ""}`}
								className="flex min-w-0 flex-1 items-start gap-3 p-4 hover:bg-accent/50"
							>
								{item.isUnread ? <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" /> : <MailOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
								<div className="flex min-w-0 flex-col gap-1">
									<span className={`truncate text-sm ${item.isUnread ? "font-bold" : "font-medium"}`}>{item.subject || t("message.noSubject")}</span>
									<span className="text-xs text-muted-foreground">
										{[item.department, item.date].filter(Boolean).join(" · ")}
									</span>
									<div className="flex flex-wrap gap-2">
										{item.unreadCount > 0 ? <Badge>{t("message.unread", {count: item.unreadCount})}</Badge> : null}
										{item.isOld ? <Badge variant="secondary">{t("message.old")}</Badge> : null}
									</div>
								</div>
							</Link>
							{item.isOld ? null : (
								<Button type="button" variant="ghost" size="icon" className="m-2 shrink-0 self-center text-destructive" aria-label={t("message.delete")} onClick={() => setToDelete(item)}>
									<Trash2 aria-hidden="true" />
								</Button>
							)}
						</li>
					))}
				</ul>
			)}

			<AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !remove.isPending && setToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("message.deleteTitle")}</AlertDialogTitle>
						<AlertDialogDescription>{t("message.deleteQuestion", {subject: toDelete?.subject ?? ""})}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>{t("message.cancel")}</AlertDialogCancel>
						<Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>
							{remove.isPending ? t("message.deleting") : t("message.delete")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
