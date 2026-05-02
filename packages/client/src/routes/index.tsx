import { RouteObject } from "react-router";
import AccessControl from "./access-control";
import Auth from "../pages/auth";
import { appPaths } from "./paths";
import Landing from "../pages/landing";

export const clientAppRoutes : RouteObject[] = [{
    path : appPaths.auth,
    element : <AccessControl onLoginPage>
        <Auth/>
    </AccessControl>
}, {
    path : appPaths.landing,
    element : <AccessControl>
        <Landing/>
    </AccessControl>
}]