import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Upload": Upload,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};