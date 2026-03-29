import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import NewExpense from './pages/NewExpense';
import ExpenseDetail from './pages/ExpenseDetail';
import Approvals from './pages/Approvals';
import Team from './pages/Team';
import Workflows from './pages/Workflows';
import Settings from './pages/Settings';
import DashboardLayout from './components/DashboardLayout';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
        <p className="text-dark-400 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="expenses/new" element={<NewExpense />} />
            <Route path="expenses/:id" element={<ExpenseDetail />} />
            <Route path="approvals" element={<ProtectedRoute roles={['admin', 'manager']}><Approvals /></ProtectedRoute>} />
            <Route path="team" element={<ProtectedRoute roles={['admin']}><Team /></ProtectedRoute>} />
            <Route path="workflows" element={<ProtectedRoute roles={['admin']}><Workflows /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
