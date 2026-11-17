import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowRight} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {Textarea} from "@/components/ui/textarea"
import {replyToMessage} from "@/features/message/api/message"
import {messageKeys, messageThreadOptions} from "@/features/message/api/message.queries"

const MAX_BODY = 2000

/** One conversation: every entry, newest first, and a box to answer (not for messages kept from the old bank). */
export default function MessageDetailPage() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const id = Number(params.get("id"))
	const isOld = params.get("old") === "1"
	const valid = Number.isInteger(id) && id > 0

	const thread = useQuery({...messageThreadOptions(id, isOld), enabled: valid})
	const [body, setBody] = React.useState("")
	const [notice, setNotice] = React.useState<{ok: boolean; text: string} | null>(null)

	const reply = useMutation({
		mutationFn: () => replyToMessage(id, body.trim()),
		onSuccess: (result) => {
			setNotice({ok: result.ok, text: result.message || (result.ok ? t("message.replySent") : t("message.replyFailed"))})
			if (result.ok) {
				setBody("")
				void queryClient.invalidateQueries({queryKey: messageKeys.all})
			}
		},
		// The request may or may not have arrived: say so instead of inviting a blind second send.
		onError: () => setNotice({ok: false, text: t("message.replyUncertain")}),
	})

	const canSend = body.trim().length > 0 && !reply.isPending

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<Button asChild variant="ghost" size="sm" className="self-start">
				<Link to={routeMap.messageList.path}>
					<ArrowRight aria-hidden="true" className="rtl:rotate-0 ltr:rotate-180" />
					{t("message.back")}
				</Link>
			</Button>

			{!valid ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("message.notFound")}
				</p>
			) : thread.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-10 w-2/3" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : thread.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{thread.error.message || t("message.error")}
				</p>
			) : (
				<>
					<div className="flex flex-col gap-1">
						<h1 className="text-2xl font-bold">{thread.data.subject || t("message.noSubject")}</h1>
						{thread.data.department ? <p className="text-sm text-muted-foreground">{thread.data.department}</p> : null}
					</div>

					{isOld ? null : (
						<form
							className="flex flex-col gap-3 rounded-lg border bg-card p-4"
							onSubmit={(event) => {
								event.preventDefault()
								if (canSend) reply.mutate()
							}}
						>
							<label htmlFor="reply-body" className="text-sm font-medium">
								{t("message.reply")}
							</label>
							<Textarea id="reply-body" value={body} maxLength={MAX_BODY} rows={4} onChange={(event) => setBody(event.target.value)} />
							{notice ? (
								<p role={notice.ok ? "status" : "alert"} className={`text-sm ${notice.ok ? "" : "text-destructive"}`}>
									{notice.text}
								</p>
							) : null}
							<Button type="submit" className="self-end" disabled={!canSend}>
								{reply.isPending ? t("message.sending") : t("message.send")}
							</Button>
						</form>
					)}

					<ul className="flex flex-col gap-3">
						{thread.data.entries.map((entry, index) => (
							<li
								key={index}
								className={`flex max-w-[85%] flex-col gap-1 rounded-lg border p-4 ${entry.fromBank ? "self-start bg-card" : "self-end bg-primary/10"}`}
							>
								<span className="text-xs font-semibold text-muted-foreground">{entry.fromBank ? t("message.fromBank") : t("message.fromYou")}</span>
								<p className="whitespace-pre-wrap text-sm">{entry.body}</p>
								<span className="text-xs text-muted-foreground">{entry.date}</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	)
}
