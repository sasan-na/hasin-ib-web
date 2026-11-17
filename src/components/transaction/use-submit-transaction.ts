import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useNavigate} from "react-router-dom"

import type {TransactionResult} from "@/lib/api/transaction"
import {routeMap} from "@/routing.tsx"
import type {TransactionResultState} from "@/routes/transaction-result"

interface Options {
	/** Sends the transaction. It should throw when the form is incomplete, so nothing half-built is sent. */
	run: () => Promise<TransactionResult>
	/** Where "do it again" leads from the result page. */
	again: {to: string; label: string}
	/** Shown when the bank refused before recording anything and gave no text of its own. */
	failedText: string
	/** Shown when the request failed on the way, so nobody knows whether the bank acted. */
	uncertainText: string
}

/**
 * The rules every confirmed transaction follows:
 * - one confirmation sends one request (the caller disables its button while `pending`, and nothing retries by itself);
 * - a refusal before anything was recorded stays on the confirm dialog (`refusal`) so it can be fixed;
 * - anything with a reference number, and every success, is an outcome and goes to the result page;
 * - a network failure may have reached the bank, so `blocked` stays true until `reset()` (a fresh review),
 *   which stops a second request from doing the same thing twice.
 */
export function useSubmitTransaction({run, again, failedText, uncertainText}: Options) {
	const navigate = useNavigate()
	const [refusal, setRefusal] = useState<string | null>(null)
	const [blocked, setBlocked] = useState(false)

	const mutation = useMutation({
		mutationFn: run,
		onSuccess: (result) => {
			if (!result.ok && result.transactionId === null) {
				setRefusal(result.message || failedText)
				return
			}
			const state: TransactionResultState = {result, again}
			void navigate(routeMap.transactionResult.path, {state, replace: true})
		},
		onError: () => {
			setRefusal(uncertainText)
			setBlocked(true)
		},
	})

	return {
		submit: () => mutation.mutate(),
		pending: mutation.isPending,
		refusal,
		blocked,
		/** Forgets the last attempt; call it when the user starts a new review. */
		reset: () => {
			setRefusal(null)
			setBlocked(false)
		},
	}
}
