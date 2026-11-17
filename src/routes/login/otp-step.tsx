import {useTranslation} from "react-i18next"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {Input} from "@/components/ui/input"
import {normalizeDigits} from "@/lib/normalize-digits"

import type {OtpContext, SignedIn} from "./loginFlow"
import {LOGIN_LIMITS} from "./loginSchema"
import {useOtpForm} from "./useOtpForm"

interface OtpStepProps {
	context: OtpContext
	onSignedIn: (signedIn: SignedIn) => void
	onRestart: (message: string) => void
}

/** The second sign-in step: the code the bank sent by SMS. */
export function OtpStep({context, onSignedIn, onRestart}: OtpStepProps) {
	const {t} = useTranslation("auth")
	const {form, onSubmit, blockedMessage, notice, resend} = useOtpForm({context, onSignedIn, onRestart})

	if (blockedMessage !== null) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{blockedMessage}</AlertDescription>
			</Alert>
		)
	}

	return (
		<Form {...form}>
			<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
				<p className="text-sm wrap-break-word text-muted-foreground">{t("login.otp.intro")}</p>
				<FormField
					control={form.control}
					name="otp"
					render={({field}) => (
						<FormItem>
							<FormLabel>{t("login.otp.label")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									onChange={(event) => field.onChange(normalizeDigits(event.target.value))}
									inputMode="numeric"
									autoComplete="one-time-code"
									dir="ltr"
									maxLength={LOGIN_LIMITS.OTP_MAX}
									placeholder={t("login.otp.placeholder")}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{form.formState.errors.root ? (
					<Alert variant="destructive">
						<AlertDescription>{form.formState.errors.root.message}</AlertDescription>
					</Alert>
				) : null}
				{notice ? (
					<p className="text-sm wrap-break-word text-muted-foreground" role="status">
						{notice}
					</p>
				) : null}

				<Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
					{form.formState.isSubmitting ? t("login.otp.confirming") : t("login.otp.confirm")}
				</Button>
				<Button type="button" variant="outline" className="w-full" disabled={!resend.canResend} onClick={resend.onResend}>
					{t("login.otp.resend")}
				</Button>
				{resend.secondsLeft > 0 ? (
					// A timer, not a live region: announcing every tick would drown the screen reader.
					<p role="timer" className="text-center text-sm text-muted-foreground">
						{t("login.otp.resendIn", {seconds: resend.secondsLeft})}
					</p>
				) : null}
			</form>
		</Form>
	)
}
