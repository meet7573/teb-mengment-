import React, { lazy, Suspense, useState, useEffect } from 'react';
import { PhotoSidebar } from './components/PhotoSidebar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { CheckoutRequestsPanel } from './components/Dashboard/CheckoutRequestsPanel';
import { StudentManagementSafe } from './components/Students/StudentManagementSafe';
import { TabletManagement } from './components/Tablets/TabletManagement';
import { TabletBoxManagement } from './components/TabletBoxes/TabletBoxManagement';
import { TabletAssignmentView } from './components/Assignments/TabletAssignment';
import { SettingsView } from './components/Settings/SettingsView';
import { PhotoManagement } from './components/PhotoManagement/PhotoManagement';
import { TabletUsage } from './components/TabletUsage/TabletUsage';
import { TabletMovementManagement } from './components/TabletMovement/TabletMovementManagement';
import { StudentDownload } from './components/StudentDownload/StudentDownload';
import { AuditLogsModal } from './components/Security/AuditLogsModal';
import { SuperAdminLogin } from './components/Auth/SuperAdminLogin';
import { LogoutModal } from './components/Auth/LogoutModal';
import { UserManagementModal } from './components/Auth/UserManagementModal';
import { ThemeSettingsModal } from './components/Theme/ThemeSettingsModal';
import { ThemeProvider } from './context/ThemeContext';
import { StudentTabletApp } from './student/StudentTabletApp';
import { getStoredRole, saveStoredRole, clearAllDatabase } from './utils/storage';
import { subscribeToCollection, syncCollection } from './lib/db';
import { AppUser, getCurrentUser, logoutUser } from './utils/auth';
import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, TabletMovement, UserRole } from './types';

const DigitalAttendance = lazy(() => import('./components/Attendance/DigitalAttendance').then((module) => ({ default: module.DigitalAttendance })));
const ReportsView = lazy(() => import('./components/Reports/ReportsView').then((module) => ({ default: module.ReportsView })));

class PageErrorBoundary extends React.Component<{ children: React.ReactNode; pageName: string }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };
  static getDerivedStateFromError(error: unknown) { return { hasError: true, message: error instanceof Error ? error.message : 'Unknown page error' }; }
  componentDidCatch(error: unknown) { console.error(`Failed to render ${this.props.pageName}:`, error); }
  render() {
    if (this.state.hasError) return <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6"><div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-900">{this.props.pageName} could not be loaded</h2><p className="mt-2 text-sm text-slate-600">The rest of the application is still available. Please refresh once after the latest deployment.</p><pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-red-700">{this.state.message}</pre><button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Reload Page</button></div></div>;
    return this.props.children;
  }
}

function MainApp() {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(getCurrentUser);
  const [activeRole, setActiveRole] = useState<UserRole>(() => currentUser?.role || getStoredRole());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [students, setStudentsState] = useState<Student[]>([]);
  const [tablets, setTabletsState] = useState<Tablet[]>([]);
  const [boxes, setBoxesState] = useState<TabletBox[]>([]);
  const [assignments, setAssignmentsState] = useState<TabletAssignment[]>([]);
  const [attendanceRecords, setAttendanceRecordsState] = useState<DailyAttendanceRecord[]>([]);
  const [movements, setMovementsState] = useState<TabletMovement[]>([]);

  useEffect(() => { const handleExpired = () => { localStorage.removeItem('stm_admin_session_token'); logoutUser(); setCurrentUserState(null); setStudentsState([]); setTabletsState([]); setBoxesState([]); setAssignmentsState([]); setAttendanceRecordsState([]); }; window.addEventListener('stm-admin-session-expired', handleExpired); return () => window.removeEventListener('stm-admin-session-expired', handleExpired); }, []);
  useEffect(() => { if (!currentUser) return; const unsubStudents = subscribeToCollection<Student>('students', setStudentsState); const unsubTablets = subscribeToCollection<Tablet>('tablets', setTabletsState); const unsubBoxes = subscribeToCollection<TabletBox>('boxes', setBoxesState); const unsubAssignments = subscribeToCollection<TabletAssignment>('assignments', setAssignmentsState); const unsubAttendance = subscribeToCollection<DailyAttendanceRecord>('attendance', setAttendanceRecordsState); const unsubMovements = subscribeToCollection<TabletMovement>('movements', setMovementsState); return () => { unsubStudents(); unsubTablets(); unsubBoxes(); unsubAssignments(); unsubAttendance(); unsubMovements(); }; }, [currentUser]);
  useEffect(() => { document.documentElement.classList.remove('dark'); localStorage.setItem('stm_theme', 'light'); }, []);
  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === 'k') { e.preventDefault(); setIsSearchOpen(true); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);

  const handleRoleChange = (role: UserRole) => { setActiveRole(role); saveStoredRole(role); };
  const handleLoginSuccess = (user: AppUser) => { setCurrentUserState(user); setActiveRole(user.role); saveStoredRole(user.role); };
  const handleConfirmLogout = async () => { const token = localStorage.getItem('stm_admin_session_token'); if (token) await fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined); localStorage.removeItem('stm_admin_session_token'); logoutUser(); setCurrentUserState(null); setIsLogoutOpen(false); };
  const handleSaveStudents = async (updated: Student[]) => { try { await syncCollection('students', students, updated); } catch (e) { console.error('Failed to sync students', e); } };
  const handleSaveTablets = async (updated: Tablet[]) => { try { await syncCollection('tablets', tablets, updated); } catch (e) { console.error('Failed to sync tablets', e); } };
  const handleSaveBoxes = async (updated: TabletBox[]) => { try { await syncCollection('boxes', boxes, updated); } catch (e) { console.error('Failed to sync boxes', e); } };
  const handleSaveAssignments = async (updated: TabletAssignment[]) => { try { await syncCollection('assignments', assignments, updated); } catch (e) { console.error('Failed to sync assignments', e); } };
  const handleSaveAttendance = async (updated: DailyAttendanceRecord[]) => { try { await syncCollection('attendance', attendanceRecords, updated); } catch (e) { console.error('Failed to sync attendance', e); } };
  const handleSaveMovements = async (updated: TabletMovement[]) => { try { await syncCollection('movements', movements, updated); } catch (e) { console.error('Failed to sync movements', e); throw e; } };
  const handleResetData = () => { clearAllDatabase(); setStudentsState([]); setTabletsState([]); setBoxesState([]); setAssignmentsState([]); setAttendanceRecordsState([]); setIsAuditLogsOpen(false); };
  const [preselectedStudent, setPreselectedStudent] = useState<Student | null>(null);
  const [preselectedTablet, setPreselectedTablet] = useState<Tablet | null>(null);
  const handleQuickAssignFromStudent = (student: Student) => { setPreselectedStudent(student); setPreselectedTablet(null); setActiveTab('assignments'); };
  const handleQuickAssignFromTablet = (tablet: Tablet) => { setPreselectedTablet(tablet); setPreselectedStudent(null); setActiveTab('assignments'); };
  if (!currentUser) return <SuperAdminLogin isOpen={true} onLoginSuccess={handleLoginSuccess} />;
  const pageFallback = <div className="flex-1 min-h-[70vh] flex items-center justify-center text-sm font-semibold text-slate-500">Loading page...</div>;

  return <div className="min-h-screen bg-[var(--bg-color,#F8FAFC)] text-[var(--font-color,#0F172A)] font-sans antialiased selection:bg-indigo-600 selection:text-white flex"><PhotoSidebar activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} currentUser={currentUser} activeRole={activeRole} setActiveRole={handleRoleChange} onOpenSearch={() => setIsSearchOpen(true)} onOpenAuditLogs={() => setIsAuditLogsOpen(true)} onOpenUsersModal={() => setIsUsersModalOpen(true)} onOpenThemeModal={() => setIsThemeModalOpen(true)} onOpenLogout={() => setIsLogoutOpen(true)} /><main className={`flex-1 transition-all duration-300 min-w-0 ${sidebarCollapsed ? 'ml-16' : 'ml-16 sm:ml-64'} ${activeTab === 'attendance' ? 'h-screen overflow-hidden p-4 sm:p-6 flex flex-col' : 'p-4 sm:p-6 min-h-screen'}`}>
    {activeTab === 'dashboard' && <><DashboardView students={students} tablets={tablets} boxes={boxes} attendanceRecords={attendanceRecords} onNavigate={(tab) => setActiveTab(tab)} /><CheckoutRequestsPanel /></>}
    {activeTab === 'attendance' && <PageErrorBoundary pageName="Attendance"><Suspense fallback={pageFallback}><DigitalAttendance students={students} attendanceRecords={attendanceRecords} onSaveAttendanceRecords={handleSaveAttendance} activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} /></Suspense></PageErrorBoundary>}
    {activeTab === 'students' && <StudentManagementSafe students={students} onSaveStudents={handleSaveStudents} activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} onQuickAssignTablet={handleQuickAssignFromStudent} />}
    {activeTab === 'boxes' && <TabletBoxManagement boxes={boxes} tablets={tablets} students={students} onSaveBoxes={handleSaveBoxes} onSaveTablets={handleSaveTablets} onSaveStudents={handleSaveStudents} activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} />}
    {activeTab === 'tablets' && <TabletManagement tablets={tablets} students={students} boxes={boxes} onSaveTablets={handleSaveTablets} onSaveBoxes={handleSaveBoxes} activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} onQuickAssign={handleQuickAssignFromTablet} />}
    {activeTab === 'assignments' && <TabletAssignmentView assignments={assignments} students={students} tablets={tablets} onSaveAssignments={handleSaveAssignments} onSaveStudents={handleSaveStudents} onSaveTablets={handleSaveTablets} activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} preselectedStudentForAssign={preselectedStudent} preselectedTabletForAssign={preselectedTablet} onClearPreselections={() => { setPreselectedStudent(null); setPreselectedTablet(null); }} />}
    {activeTab === 'reports' && <PageErrorBoundary pageName="Reports"><Suspense fallback={pageFallback}><ReportsView students={students} tablets={tablets} boxes={boxes} attendanceRecords={attendanceRecords} activeRole={activeRole} /></Suspense></PageErrorBoundary>}
    {activeTab === 'photo-management' && <PhotoManagement students={students} tablets={tablets} onSaveStudents={handleSaveStudents} onSaveTablets={handleSaveTablets} activeRole={activeRole} />}
    {activeTab === 'tablet-usage' && <TabletUsage />}
    {activeTab === 'tablet-movement' && <PageErrorBoundary pageName="Tablet Movement"><TabletMovementManagement movements={movements} students={students} tablets={tablets} assignments={assignments} activeRole={activeRole} onSave={handleSaveMovements} /></PageErrorBoundary>}
    {activeTab === 'student-download' && <StudentDownload />}
    {activeTab === 'settings' && <SettingsView activeRole={activeRole} onNavigate={(tab) => setActiveTab(tab)} onRoleChange={handleRoleChange} onResetData={handleResetData} />}
  </main><GlobalSearchModal students={students} tablets={tablets} boxes={boxes} assignments={assignments} isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={(tab) => setActiveTab(tab)} /><AuditLogsModal isOpen={isAuditLogsOpen} onClose={() => setIsAuditLogsOpen(false)} onResetData={handleResetData} /><ThemeSettingsModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} /><LogoutModal isOpen={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} onConfirmLogout={handleConfirmLogout} userName={currentUser?.fullName} /></div>;
}

export default function App() { if (window.location.pathname === '/student/download') return <StudentDownload />; if (window.location.pathname === '/student' || window.location.pathname.startsWith('/student/')) return <StudentTabletApp />; return <ThemeProvider><MainApp /></ThemeProvider>; }
