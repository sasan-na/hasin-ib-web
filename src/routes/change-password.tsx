import {zodResolver} from "@hookform/resolvers/zod"
import {useMutation, useQuery} from "@tanstack/react-query"
import {useMemo, useState} from "react"
import {useForm} from "react-hook-form"
import {useTranslation} from "react-i18next"
import {useNavigate} from "react-router-dom"

import {PasswordInput} from "@/components/password-input"
import {PasswordRules} from "@/components/password-rules"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {ApiError} from "@/lib/api/client"
import {changePassword, checkPasswordRules, PasswordError} from "@/lib/api/password"
import {passwordRulesOptions} from "@/lib/api/password.queries"
import {useSignOut} from "@/hooks/use-sign-out"
import {logger} from "@/lib/logger"
import {z} from "@/lib/zod"
import {routeMap} from "@/routing.tsx"
import {useSession} from "@/store/session"

// Limits carried over from the legacy form.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 35

type ChangePasswordT = ReturnType<typeof useTranslation<"auth">>["t"]

const createSchema = (t: ChangePasswordT) => {
	const password = (required: string) =>
		z
			.string()
			.min(1, required)
			.min(PASSWORD_MIN, t("changePassword.error.min", {min: PASSWORD_MIN}))
			.max(PASSWORD_MAX, t("changePassword.error.max", {max: PASSWORD_MAX}))
	return z
		.object({
			oldPassword: password(t("changePassword.error.required.oldPassword")),
			newPassword: password(t("changePassword.error.required.newPassword")),
			confirm: password(t("changePassword.error.required.confirm")),
		})
		.refine((data) => data.newPassword !== data.oldPassword, {
			path: ["newPassword"],
			message: t("changePassword.error.sameAsOld"),
		})
		.refine((data) => data.confirm === data.newPassword, {
			path: ["confirm"],
			message: t("changePassword.error.mismatch"),
		})
}

type FormValues = z.infer<ReturnType<typeof createSchema>>

/** The page a user lands on when the server demands a new password (expired, or reset by the bank). */
export default function ChangePassword() {
	const {t} = useTranslation("auth")
	const navigate = useNavigate()
	const signOut = useSignOut()
	const username = useSession((s) => s.username) ?? ""
	const mustChangePassword = useSession((s) => s.mustChangePassword)
	const passwordChanged = useSession((s) => s.passwordChanged)
	const expireLocally = useSession((s) => s.signOut)
	const rules = useQuery(passwordRulesOptions())
	// Rules the server says the new password breaks; null until it has been checked.
	const [violations, setViolations] = useState<ReadonlySet<string> | null>(null)
	const [checking, setChecking] = useState(false)

	const schema = useMemo(() => createSchema(t), [t])
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {oldPassword: "", newPassword: "", confirm: ""},
	})

	const checkRules = async (password: string): Promise<void> => {
		if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
			setViolations(null)
			return
		}
		setChecking(true)
		try {
			setViolations(new Set(await checkPasswordRules(username, password)))
		} catch (error) {
			// The submit still validates on the server, so a failed live check only loses the hints.
			logger.warn("password rule check failed", {error: String(error)})
			setViolations(null)
		} finally {
			setChecking(false)
		}
	}

	const submit = useMutation({
		mutationFn: ({oldPassword, newPassword}: FormValues) => changePassword(oldPassword, newPassword, mustChangePassword),
		onSuccess: () => {
			passwordChanged()
			void navigate(routeMap.home.path, {replace: true})
		},
		onError: (error) => {
			if (error instanceof PasswordError && error.shouldLogOut) {
				// The server ended the session (for example too many wrong old passwords).
				expireLocally()
				return
			}
			if (error instanceof PasswordError && error.ruleKeys.length > 0) {
				setViolations(new Set(error.ruleKeys))
				form.setError("root", {message: t("changePassword.error.ruleBroken")})
				return
			}
			if (error instanceof PasswordError) {
				form.setError("root", {message: error.message || t("changePassword.error.failed")})
				return
			}
			// 401/403 are handled globally by the API client; anything else is the network or the server.
			logger.error("change password failed", {error: String(error)})
			form.setError("root", {
				message: error instanceof ApiError && error.status >= 500 ? t("changePassword.error.failed") : t("changePassword.error.network"),
			})
		},
	})

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root")
		submit.mutate(values)
	})

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader className="text-center">
				<CardTitle className="text-xl">{t("changePassword.title")}</CardTitle>
				<CardDescription>{t("changePassword.description")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<Form {...form}>
					<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
						<FormField
							control={form.control}
							name="oldPassword"
							render={({field}) => (
								<FormItem>
									<FormLabel>{t("changePassword.oldPassword")}</FormLabel>
									<FormControl>
										<PasswordInput {...field} autoComplete="current-password" maxLength={PASSWORD_MAX} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="newPassword"
							render={({field}) => (
								<FormItem>
									<FormLabel>{t("changePassword.newPassword")}</FormLabel>
									<FormControl>
										<PasswordInput
											{...field}
											autoComplete="new-password"
											maxLength={PASSWORD_MAX}
											onBlur={() => {
												field.onBlur()
												void checkRules(field.value)
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="confirm"
							render={({field}) => (
								<FormItem>
									<FormLabel>{t("changePassword.newPasswordConfirm")}</FormLabel>
									<FormControl>
										<PasswordInput {...field} autoComplete="new-password" maxLength={PASSWORD_MAX} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{rules.data ? <PasswordRules rules={rules.data} violations={violations} /> : null}
						{checking ? (
							<p role="status" className="text-sm text-muted-foreground">
								{t("changePassword.checking")}
							</p>
						) : null}

						{form.formState.errors.root ? (
							<Alert variant="destructive">
								<AlertDescription>{form.formState.errors.root.message}</AlertDescription>
							</Alert>
						) : null}

						<Button type="submit" disabled={submit.isPending || checking} className="w-full">
							{submit.isPending ? t("changePassword.submitting") : t("changePassword.submit")}
						</Button>
					</form>
				</Form>
				<Button variant="outline" className="w-full" onClick={() => void signOut()}>
					{t("changePassword.logout")}
				</Button>
			</CardContent>
		</Card>
	)
}
