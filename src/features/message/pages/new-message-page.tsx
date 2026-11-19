import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { routeMap } from "@/app/routes"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { sendMessage } from "@/features/message/api/message"
import {
	departmentsOptions,
	messageKeys,
} from "@/features/message/api/message.queries"

const MAX_SUBJECT = 100
const MAX_BODY = 2000

/** Starts a new conversation with one of the bank's departments. */
export default function NewMessagePage() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const departments = useQuery(departmentsOptions())
	const [departmentId, setDepartmentId] = React.useState("")
	const [subject, setSubject] = React.useState("")
	const [body, setBody] = React.useState("")
	const [error, setError] = React.useState<string | null>(null)

	const send = useMutation({
		mutationFn: () =>
			sendMessage({
				departmentId: Number(departmentId),
				subject: subject.trim(),
				body: body.trim(),
			}),
		onSuccess: (result) => {
			if (!result.ok) {
				setError(result.message || t("message.sendFailed"))
				return
			}
			void queryClient.invalidateQueries({ queryKey: messageKeys.list })
			void navigate(routeMap.messageList.path)
		},
		// The message may have been created: send the user to the inbox to check, not back to a form that would send it twice.
		onError: () => setError(t("message.sendUncertain")),
	})

	const canSend =
		departmentId !== "" &&
		subject.trim() !== "" &&
		body.trim() !== "" &&
		!send.isPending

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("message.newTitle")}</h1>

			{departments.isPending ? (
				<Skeleton className="h-64 w-full" aria-hidden="true" />
			) : departments.isError ? (
				<p
					role="alert"
					className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
				>
					{departments.error.message || t("message.departmentsError")}
				</p>
			) : (
				<form
					onSubmit={(event) => {
						event.preventDefault()
						setError(null)
						if (canSend) send.mutate()
					}}
				>
					<FlowLayout
						aside={
							<FlowSummary
								id="nm-summary"
								title={t("message.summary")}
								amount={null}
								rows={[
									{
										label: t("message.department"),
										value:
											departments.data.find(
												(item) => String(item.id) === departmentId,
											)?.title ?? null,
									},
									{
										label: t("message.subject"),
										value: subject.trim() !== "" ? subject.trim() : null,
									},
								]}
								reviewLabel={
									send.isPending ? t("message.sending") : t("message.send")
								}
								onReview={() => {
									setError(null)
									if (canSend) send.mutate()
								}}
							/>
						}
					>
						<StepSection id="nm-to" step={1} title={t("message.toStep")}>
							<div className="flex flex-col gap-2">
								<Label htmlFor="message-department">
									{t("message.department")}
								</Label>
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
						</StepSection>
						<StepSection id="nm-body" step={2} title={t("message.bodyStep")}>
							<div className="flex flex-col gap-2">
								<Label htmlFor="message-subject">{t("message.subject")}</Label>
								<Input
									id="message-subject"
									className="h-11 text-base"
									value={subject}
									maxLength={MAX_SUBJECT}
									onChange={(event) => setSubject(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="message-body">{t("message.body")}</Label>
								<Textarea
									id="message-body"
									value={body}
									rows={6}
									maxLength={MAX_BODY}
									onChange={(event) => setBody(event.target.value)}
								/>
							</div>
							{error ? <FieldError>{error}</FieldError> : null}
							<div>
								<Button asChild variant="outline">
									<Link to={routeMap.messageList.path}>
										{t("message.cancel")}
									</Link>
								</Button>
							</div>
						</StepSection>
					</FlowLayout>
				</form>
			)}
		</div>
	)
}
