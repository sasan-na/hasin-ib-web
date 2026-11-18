import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link, useNavigate} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {Textarea} from "@/components/ui/textarea"
import {sendMessage} from "@/features/message/api/message"
import {departmentsOptions, messageKeys} from "@/features/message/api/message.queries"

const MAX_SUBJECT = 100
const MAX_BODY = 2000

/** Starts a new conversation with one of the bank's departments. */
export default function NewMessagePage() {
	const {t} = useTranslation()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const departments = useQuery(departmentsOptions())
	const [departmentId, setDepartmentId] = React.useState("")
	const [subject, setSubject] = React.useState("")
	const [body, setBody] = React.useState("")
	const [error, setError] = React.useState<string | null>(null)

	const send = useMutation({
		mutationFn: () => sendMessage({departmentId: Number(departmentId), subject: subject.trim(), body: body.trim()}),
		onSuccess: (result) => {
			if (!result.ok) {
				setError(result.message || t("message.sendFailed"))
				return
			}
			void queryClient.invalidateQueries({queryKey: messageKeys.list})
			void navigate(routeMap.messageList.path)
		},
		// The message may have been created: send the user to the inbox to check, not back to a form that would send it twice.
		onError: () => setError(t("message.sendUncertain")),
	})

	const canSend = departmentId !== "" && subject.trim() !== "" && body.trim() !== "" && !send.isPending

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("message.newTitle")}</h1>

			{departments.isPending ? (
				<Skeleton className="h-64 w-full" aria-hidden="true" />
			) : departments.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{departments.error.message || t("message.departmentsError")}
				</p>
			) : (
				<form
					className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card"
					onSubmit={(event) => {
						event.preventDefault()
						setError(null)
						if (canSend) send.mutate()
					}}
				>
					<div className="flex flex-col gap-2">
						<label htmlFor="message-department" className="text-sm font-medium">
							{t("message.department")}
						</label>
						<Select value={departmentId} onValueChange={setDepartmentId}>
							<SelectTrigger id="message-department" className="w-full">
								<SelectValue placeholder={t("message.chooseDepartment")} />
							</SelectTrigger>
							<SelectContent>
								{departments.data.map((item) => (
									<SelectItem key={item.id} value={String(item.id)}>
										{item.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="message-subject" className="text-sm font-medium">
							{t("message.subject")}
						</label>
						<Input id="message-subject" value={subject} maxLength={MAX_SUBJECT} onChange={(event) => setSubject(event.target.value)} />
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="message-body" className="text-sm font-medium">
							{t("message.body")}
						</label>
						<Textarea id="message-body" value={body} rows={6} maxLength={MAX_BODY} onChange={(event) => setBody(event.target.value)} />
					</div>
					{error ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<Button asChild variant="outline">
							<Link to={routeMap.messageList.path}>{t("message.cancel")}</Link>
						</Button>
						<Button type="submit" disabled={!canSend}>
							{send.isPending ? t("message.sending") : t("message.send")}
						</Button>
					</div>
				</form>
			)}
		</div>
	)
}
