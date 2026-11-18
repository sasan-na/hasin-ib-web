import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {finishActivation, startActivation, type ActivationAttempt} from "@/features/cheque/api/chakad-activation"
import {getChakadActivated} from "@/features/cheque/api/chakad-issue"
import {getMyNationalCode} from "@/features/profile/api/profile"

const KEY = ["cheque", "chakad-activated"] as const

/** Turn on the digital cheque service: the registry sends a signing request to your Hamoon app, and your approval activates it. */
export default function ChakadActivatePage() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const status = useQuery({queryKey: KEY, queryFn: getChakadActivated, staleTime: 0, retry: false})
	// Set once the request has been sent to the Hamoon app.
	const [attempt, setAttempt] = useState<ActivationAttempt | null>(null)
	const [problem, setProblem] = useState<string | null>(null)
	const [uncertain, setUncertain] = useState(false)

	const start = useMutation({
		mutationFn: async () => startActivation(await getMyNationalCode()),
		onSuccess: (started) => {
			setProblem(null)
			setAttempt(started)
		},
		onError: (error: Error) => setProblem(error.message || t("cheque.activate.startFailed")),
	})

	const finish = useMutation({
		mutationFn: () => {
			if (!attempt) throw new Error("not started")
			return finishActivation(attempt)
		},
		onSuccess: (outcome) => {
			if (outcome.state === "waiting") setProblem(t("cheque.activate.waiting"))
			else if (outcome.state === "refused") setProblem(outcome.message || t("cheque.activate.failed"))
			else {
				setProblem(null)
				setAttempt(null)
				void queryClient.invalidateQueries({queryKey: KEY})
			}
		},
		// The request may have reached the bank, so do not offer to send it again until the status is checked.
		onError: () => {
			setUncertain(true)
			setProblem(t("cheque.activate.uncertain"))
		},
	})

	const checkAgain = (): void => {
		setUncertain(false)
		setProblem(null)
		setAttempt(null)
		void queryClient.invalidateQueries({queryKey: KEY})
	}

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.activate.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.activate.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg bg-card p-5">
				{status.isPending ? (
					<Skeleton className="h-16 w-full" />
				) : status.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("cheque.activate.statusError")}
					</p>
				) : status.data ? (
					<>
						<p role="status" className="text-sm font-medium text-success">
							{t("cheque.activate.active")}
						</p>
						<div>
							<Button asChild variant="outline">
								<Link to={routeMap.chequeList.path}>{t("cheque.title")}</Link>
							</Button>
						</div>
					</>
				) : (
					<>
						<p className="text-sm">{attempt ? t("cheque.activate.approve") : t("cheque.activate.notActive")}</p>
						{problem ? (
							<Alert variant="destructive">
								<AlertDescription>{problem}</AlertDescription>
							</Alert>
						) : null}
						<div className="flex flex-wrap gap-2">
							{uncertain ? (
								<Button type="button" onClick={checkAgain}>
									{t("cheque.activate.checkStatus")}
								</Button>
							) : attempt ? (
								<>
									<Button type="button" disabled={finish.isPending} onClick={() => finish.mutate()}>
										{finish.isPending ? t("cheque.activate.activating") : t("cheque.activate.activate")}
									</Button>
									<Button type="button" variant="outline" disabled={finish.isPending} onClick={() => setAttempt(null)}>
										{t("cheque.activate.startOver")}
									</Button>
								</>
							) : (
								<Button type="button" disabled={start.isPending} onClick={() => start.mutate()}>
									{start.isPending ? t("cheque.activate.sending") : t("cheque.activate.send")}
								</Button>
							)}
						</div>
					</>
				)}
			</section>
		</div>
	)
}
