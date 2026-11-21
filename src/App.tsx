import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './store/toast';
import { ConfirmProvider } from './components/ui';
import { AuthProvider } from './store/auth';
import { VaultProvider, ThemeApplier } from './store/vault';
import { UIProvider } from './store/ui';
import { Layout } from './components/Layout';
import { DashboardWorkbench } from './pages/DashboardWorkbench';
import { Community } from './pages/Community';
import { Prompts } from './pages/Prompts';
import { Collections, CollectionDetail } from './pages/Collections';
import { Categories } from './pages/Categories';
import { Engineer } from './pages/Engineer';
import { History } from './pages/History';
import { Trash } from './pages/Trash';
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <VaultProvider>
              <UIProvider>
                <ThemeApplier />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route element={<Layout />}>
                    <Route path="/" element={<DashboardWorkbench />} />
                    <Route path="/prompts" element={<Prompts preset="all" />} />
                    <Route path="/favorites" element={<Prompts preset="favorites" />} />
                    <Route path="/pinned" element={<Prompts preset="pinned" />} />
                    <Route path="/recent" element={<Prompts preset="recent" />} />
                    <Route path="/most-used" element={<Prompts preset="most-used" />} />
                    <Route path="/untagged" element={<Prompts preset="untagged" />} />
                    <Route path="/uncategorized" element={<Prompts preset="uncategorized" />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/collections/:id" element={<CollectionDetail />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/engineer" element={<Engineer />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/trash" element={<Trash />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/friends" element={<Community />} />
                    <Route path="/friends/:id" element={<Community />} />
                    <Route path="/teams" element={<Community />} />
                    <Route path="/teams/:id" element={<Community />} />
                    <Route path="/shared" element={<Community />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </UIProvider>
            </VaultProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
