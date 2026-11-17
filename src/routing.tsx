import React from "react";
import {createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider,} from "react-router-dom";
import {AuthShell} from "@/components/shell.tsx";
import useSelectTheme from "@/hooks/useSelectTheme.ts";

const Home = React.lazy(() => import("@/routes/home.tsx"));
const NotFound = React.lazy(() => import("@/routes/notfound"));

// Canonical map of paths and breadcrumb labels. Reference `routeMap.x.path`
// instead of hardcoding path strings.
export const routeMap = {
    "home": {breadcrumb: "Home", path: "/"},
    "notFound": {breadcrumb: "404", path: "/404"},
}

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<AuthShell/>}>
            <Route path={routeMap.home.path} element={<Home/>} index={true}/>
            <Route path={routeMap.notFound.path} element={<NotFound/>}/>
            <Route path="*" element={<Navigate to={routeMap.notFound.path}/>}/>
        </Route>
    )
)

export default function Routing() {
    useSelectTheme();
    return <RouterProvider router={router}/>;
}
