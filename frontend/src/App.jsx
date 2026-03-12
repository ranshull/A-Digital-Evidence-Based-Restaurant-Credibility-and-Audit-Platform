import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Apply from './pages/Apply';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerRestaurantEdit from './pages/OwnerRestaurantEdit';
import OwnerRestaurantPhotos from './pages/OwnerRestaurantPhotos';
import OwnerEvidenceUpload from './pages/OwnerEvidenceUpload';
import OwnerEvidenceList from './pages/OwnerEvidenceList';
import AdminApplications from './pages/admin/AdminApplications';
import AdminApplicationDetail from './pages/admin/AdminApplicationDetail';
import AdminEvidenceQueue from './pages/admin/AdminEvidenceQueue';
import AdminScoring from './pages/admin/AdminScoring';
import AdminPendingWork from './pages/admin/AdminPendingWork';
import AdminRestaurantReview from './pages/admin/AdminRestaurantReview';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminUserDetail from './pages/superadmin/SuperAdminUserDetail';
import SuperAdminCreateUser from './pages/superadmin/SuperAdminCreateUser';
import SuperAdminLogs from './pages/superadmin/SuperAdminLogs';
import SuperAdminReport from './pages/superadmin/SuperAdminReport';
import SuperAdminAssignments from './pages/superadmin/SuperAdminAssignments';
import SuperAdminEvidence from './pages/superadmin/SuperAdminEvidence';
import SuperAdminEvidenceDetail from './pages/superadmin/SuperAdminEvidenceDetail';
import SuperAdminCryptoStatus from './pages/superadmin/SuperAdminCryptoStatus';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Layout><Restaurants /></Layout>} />
          <Route path="/restaurants/:id" element={<Layout><RestaurantDetail /></Layout>} />
          <Route path="/dashboard" element={<Layout><Home /></Layout>} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout><Profile /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/register" element={<Layout><Register /></Layout>} />
          <Route
            path="/apply"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <Layout><Apply /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/application-status" element={<Navigate to="/apply" replace />} />
          <Route
            path="/owner-dashboard"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Layout><OwnerDashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner-dashboard/edit"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Layout><OwnerRestaurantEdit /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner-dashboard/photos"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Layout><OwnerRestaurantPhotos /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner-dashboard/evidence"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Layout><OwnerEvidenceList /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner-dashboard/evidence/upload"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Layout><OwnerEvidenceUpload /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/applications"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <Layout><AdminApplications /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/applications/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <Layout><AdminApplicationDetail /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR', 'SUPER_ADMIN']}>
                <Layout><AdminPendingWork /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review/:restaurantId"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR', 'SUPER_ADMIN']}>
                <Layout><AdminRestaurantReview /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/evidence"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR', 'SUPER_ADMIN']}>
                <Layout><AdminEvidenceQueue /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/scoring"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR', 'SUPER_ADMIN']}>
                <Layout><AdminScoring /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/users"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminUsers /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/users/create"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminCreateUser /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/users/:id"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminUserDetail /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/logs"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminLogs /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/report/:restaurantId"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminReport /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/assignments"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminAssignments /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/evidence"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminEvidence /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/evidence/:id"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminEvidenceDetail /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/crypto"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <Layout><SuperAdminCryptoStatus /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
