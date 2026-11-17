import {useTranslation} from "react-i18next"
import {Navigate} from "react-router-dom"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {Input} from "@/components/ui/input"
import {normalizeDigits} from "@/lib/normalize-digits"
import {routeMap} from "@/app/routes"
import {useSession} from "@/store/session"

import {CaptchaField} from "../components/captcha-field"
import {ForgotPasswordLink} from "../components/forgot-password-link"
import {LOGIN_LIMITS} from "../lib/login-schema"
import {OtpStep} from "../components/otp-step"
import {PasswordField} from "../components/password-field"
import {SecurityTips} from "../components/security-tips"
import {useLoginFlow} from "../hooks/use-login-flow"

export default function LoginPage() {
	const {t} = useTranslation("auth")
	const isSignedIn = useSession((s) => s.token !== null)
	const sessionExpired = useSession((s) => s.expired)
	const {credentials, otp, onSignedIn, restart, redirectTo} = useLoginFlow()
	const {form, onSubmit, captcha, blockedMessage} = credentials

	if (isSignedIn) return <Navigate to={redirectTo ?? routeMap.home.path} replace />

	return (
		<div className="mx-auto grid w-full max-w-3xl overflow-hidden rounded-lg border bg-card md:grid-cols-[minmax(0,1fr)_17rem]">
			<div className="flex flex-col gap-6 p-6 md:p-8">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">{t("login.title")}</h1>
					<p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
				</div>
				{sessionExpired ? (
					<Alert className="mb-4" role="status">
						<AlertDescription>{t("login.sessionExpired")}</AlertDescription>
					</Alert>
				) : null}
				{otp ? (
					<OtpStep context={otp} onSignedIn={onSignedIn} onRestart={restart} />
				) : blockedMessage !== null ? (
					<Alert variant="destructive">
						<AlertDescription>{blockedMessage}</AlertDescription>
					</Alert>
				) : (
					<Form {...form}>
						<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
							<FormField
								control={form.control}
								name="username"
								render={({field}) => (
									<FormItem>
										<FormLabel>{t("login.username")}</FormLabel>
										<FormControl>
											<Input
												{...field}
												onChange={(event) => field.onChange(normalizeDigits(event.target.value))}
												autoComplete="username"
												dir="ltr"
												maxLength={LOGIN_LIMITS.USERNAME_MAX}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<PasswordField control={form.control} />
							<CaptchaField control={form.control} status={captcha.status} image={captcha.image} onRefresh={captcha.refresh} />

							{form.formState.errors.root ? (
								<Alert variant="destructive">
									<AlertDescription>{form.formState.errors.root.message}</AlertDescription>
								</Alert>
							) : null}

							<Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
								{form.formState.isSubmitting ? t("login.submitting") : t("login.submit")}
							</Button>
							<ForgotPasswordLink href={import.meta.env.VITE_PASSWORD_RECOVERY_URL} />
						</form>
					</Form>
				)}
			</div>
			<aside className="border-t bg-muted/60 p-6 md:border-t-0 md:border-s md:p-8">
				<SecurityTips />
			</aside>
		</div>
	)
}
