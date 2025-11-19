import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Batches from './pages/Batches';
import BatchDetails from './pages/BatchDetails';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Upload": Upload,
    "Batches": Batches,
    "BatchDetails": BatchDetails,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};