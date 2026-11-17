import {useState} from "react"

import {routeMap} from "@/app/routes"
import {useSession} from "@/store/session"

import type {OtpContext, SignedIn} from "./loginFlow"
import {useLoginForm} from "./useLoginForm"

/** The sign-in flow: credentials, then (when the server asks) a one-time code, then the session. */
export const useLoginFlow = () => {
	const signIn = useSession((s) => s.signIn)
	const [otp, setOtp] = useState<OtpContext | null>(null)
	const [redirectTo, setRedirectTo] = useState<string | null>(null)

	const onSignedIn = ({username, token, mustChangePassword}: SignedIn): void => {
		signIn(username, token, mustChangePassword)
		// One redirect, performed by the page: calling navigate here would race the page's own
		// "already signed in" redirect and could lose to it.
		setRedirectTo(mustChangePassword ? routeMap.changePassword.path : routeMap.home.path)
		setOtp(null)
	}

	const credentials = useLoginForm({onOtp: setOtp, onSignedIn})

	const restart = (message: string): void => {
		setOtp(null)
		credentials.restart(message)
	}

	return {credentials, otp, onSignedIn, restart, redirectTo}
}
