import React from "react";
import {createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider,} from "react-router-dom";
import {AuthShell, PublicShell} from "@/components/shell.tsx";
import useSelectTheme from "@/hooks/useSelectTheme.ts";
import {useSession} from "@/store/session";

const Home = React.lazy(() => import("@/routes/home.tsx"));
const Login = React.lazy(() => import("@/routes/login/page.tsx"));
const ChangePassword = React.lazy(() => import("@/routes/change-password.tsx"));
const NotFound = React.lazy(() => import("@/routes/notfound"));

// Canonical map of paths and breadcrumb i18n keys. Reference `routeMap.x.path`
// instead of hardcoding path strings.
export const routeMap = {
    "home": {breadcrumb: "navigation.home", path: "/"},
    "login": {breadcrumb: "auth.signIn", path: "/login"},
    "changePassword": {breadcrumb: "auth.changePassword", path: "/change-password"},
    "notFound": {breadcrumb: "notFound.title", path: "/404"},
}

// The session lives in memory only, so a refresh lands here and sends the user to login.
function RequireAuth() {
    const signedIn = useSession((s) => s.token !== null)
    return signedIn ? <Outlet/> : <Navigate to={routeMap.login.path} replace/>
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
