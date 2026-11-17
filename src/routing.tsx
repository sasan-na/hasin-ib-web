import React from "react";
import {createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider, useLocation,} from "react-router-dom";
import {AuthShell, PublicShell} from "@/components/shell.tsx";
import useSelectTheme from "@/hooks/useSelectTheme.ts";
import {useSession} from "@/store/session";

const Home = React.lazy(() => import("@/routes/home.tsx"));
const Account = React.lazy(() => import("@/routes/account/page.tsx"));
const AccountInfo = React.lazy(() => import("@/routes/account/info-page.tsx"));
const Login = React.lazy(() => import("@/routes/login/page.tsx"));
const ChangePassword = React.lazy(() => import("@/routes/change-password.tsx"));
const NotFound = React.lazy(() => import("@/routes/notfound"));

// Canonical map of paths and breadcrumb i18n keys. Reference `routeMap.x.path`
// instead of hardcoding path strings.
export const routeMap = {
    "home": {breadcrumb: "navigation.home", path: "/"},
    "account": {breadcrumb: "navigation.accounts", path: "/account"},
    "accountInfo": {breadcrumb: "account.info.title", path: "/account/info"},
    "login": {breadcrumb: "auth.signIn", path: "/login"},
    "changePassword": {breadcrumb: "auth.changePassword", path: "/change-password"},
    "notFound": {breadcrumb: "notFound.title", path: "/404"},
}

// The session lives in memory only, so a refresh lands here and sends the user to login.
function RequireAuth() {
    const signedIn = useSession((s) => s.token !== null)
    const mustChangePassword = useSession((s) => s.mustChangePassword)
    const {pathname} = useLocation()
    if (!signedIn) return <Navigate to={routeMap.login.path} replace/>
    // A user whose password must change can reach nothing but the change-password page.
    if (mustChangePassword && pathname !== routeMap.changePassword.path) {
        return <Navigate to={routeMap.changePassword.path} replace/>
    }
    return <Outlet/>
}

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route element={<PublicShell/>}>
                <Route path={routeMap.login.path} element={<Login/>}/>
            </Route>
            <Route element={<RequireAuth/>}>
                <Route element={<PublicShell/>}>
                    <Route path={routeMap.changePassword.path} element={<ChangePassword/>}/>
                </Route>
                <Route element={<AuthShell/>}>
                    <Route path={routeMap.home.path} element={<Home/>} index={true}/>
                    <Route path={routeMap.account.path} element={<Account/>}/>
                    <Route path={routeMap.accountInfo.path} element={<AccountInfo/>}/>
                    <Route path={routeMap.notFound.path} element={<NotFound/>}/>
                    <Route path="*" element={<Navigate to={routeMap.notFound.path}/>}/>
                </Route>
            </Route>
        </>
    )
)

export default function Routing() {
    useSelectTheme();
    return <RouterProvider router={router}/>;
}
