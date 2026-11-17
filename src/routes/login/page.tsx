import {useTranslation} from "react-i18next"
import {Navigate} from "react-router-dom"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {Input} from "@/components/ui/input"
import {normalizeDigits} from "@/lib/auth/normalizeDigits"
import {routeMap} from "@/routing.tsx"
import {useSession} from "@/store/session"

import {CaptchaField} from "./captcha-field"
import {ForgotPasswordLink} from "./forgot-password-link"
import {LOGIN_LIMITS} from "./loginSchema"
import {OtpStep} from "./otp-step"
import {PasswordField} from "./password-field"
import {SecurityTips} from "./security-tips"
import {useLoginFlow} from "./useLoginFlow"

export default function LoginPage() {
	const {t} = useTranslation("auth")
	const isSignedIn = useSession((s) => s.token !== null)
	const {credentials, otp, onSignedIn, restart, redirectTo} = useLoginFlow()
	const {form, onSubmit, captcha, blockedMessage} = credentials

	if (isSignedIn) return <Navigate to={redirectTo ?? routeMap.home.path} replace />

	return (
		<Card className="mx-auto w-full max-w-sm">
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">{t("login.title")}</CardTitle>
				<CardDescription>{t("login.subtitle")}</CardDescription>
			</CardHeader>
			<CardContent>
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
							<SecurityTips />
						</form>
					</Form>
				)}
			</CardContent>
		</Card>
	)
}
