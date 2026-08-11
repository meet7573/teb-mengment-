import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { StudentManagement } from './components/Students/StudentManagement';
import { TabletManagement } from './components/Tablets/TabletManagement';
import { TabletBoxManagement } from './components/TabletBoxes/TabletBoxManagement';
import { TabletAssignmentView } from './components/Assignments/TabletAssignment';
import { DigitalAttendance } from './components/Attendance/DigitalAttendance';
import { ReportsView } from './components/Reports/ReportsView';
import { SettingsView } from './components/Settings/SettingsView';
import { AuditLogsModal } from './components/Security/AuditLogsModal';
import { LoginModal } from './components/Auth/LoginModal';
import { LogoutModal } from './components/Auth/LogoutModal';
import { UserManagementModal } from './components/Auth/UserManagementModal';
import { ThemeSettingsModal } from './components/Theme/ThemeSettingsModal';
import { ThemeProvider } from './context/ThemeContext';

import { 
  getStudents, saveStudents,
  getTablets, saveTablets,
  getTabletBoxes, saveTabletBoxes,
  getAssignments, saveAssignments,
  getAttendanceRecords, saveAttendanceRecords,
  getStoredRole, saveStoredRole,
  initLocalStorage, clearAllDatabase
} from './utils/storage';
import { AppUser, getCurrentUser, logoutUser } from './utils/auth';
import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, UserRole } from './types';

function MainApp() {
  // Current Authenticated User state
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(getCurrentUser);

  // Active Role state
  const [activeRole, setActiveRole] = useState<UserRole>(() => currentUser?.role || getStoredRole());

  // Sidebar Collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Data State
  const [students, setStudentsState] = useState<Student[]>([]);
  const [tablets, setTabletsState] = useState<Tablet[]>(getTablets);
  const [boxes, setBoxesState] = useState<TabletBox[]>(getTabletBoxes);
  const [assignments, setAssignmentsState] = useState<TabletAssignment[]>(getAssignments);
  const [attendanceRecords, setAttendanceRecordsState] = useState<DailyAttendanceRecord[]>(getAttendanceRecords);

  // Fetch initial data from SQLite backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/sync/all');
        if (res.ok) {
          const data = await res.json();
          const mappedStudents: Student[] = data.students.map((d: any) => ({
            id: d.id,
            pinNumber: d.pinNumber,
            name: d.name,
            standard: d.standard as any,
            isCoachingStudent: d.isCoachingStudent,
            status: d.status,
            createdAt: d.createdAt
          }));
          setStudentsState(mappedStudents);
          setAttendanceRecordsState(data.attendanceRecords);
          
          // Also persist back to localStorage just in case UI expects it
          saveStudents(mappedStudents);
          saveAttendanceRecords(data.attendanceRecords);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  // Quick Pre-selection state for Tablet Assignment
  const [preselectedStudent, setPreselectedStudent] = useState<Student | null>(null);
  const [preselectedTablet, setPreselectedTablet] = useState<Tablet | null>(null);

  // Enforce Light Theme globally
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('stm_theme', 'light');
  }, []);

  // Keyboard Shortcut ⌘K for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync role
  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    saveStoredRole(role);
  };

  // Auth Handlers
  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUserState(user);
    setActiveRole(user.role);
    saveStoredRole(user.role);
  };

  const handleConfirmLogout = () => {
    logoutUser();
    setCurrentUserState(null);
    setIsLogoutOpen(false);
  };

  // Data Save Handlers
  const handleSaveStudents = async (updated: Student[]) => {
    setStudentsState(updated);
    saveStudents(updated);
    try {
      await fetch('/api/sync/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) { console.error('Failed to sync students', e); }
  };

  const handleSaveTablets = (updated: Tablet[]) => {
    setTabletsState(updated);
    saveTablets(updated);
    setBoxesState(getTabletBoxes());
  };

  const handleSaveBoxes = (updated: TabletBox[]) => {
    setBoxesState(updated);
    saveTabletBoxes(updated);
  };

  const handleSaveAssignments = (updated: TabletAssignment[]) => {
    setAssignmentsState(updated);
    saveAssignments(updated);
  };

  const handleSaveAttendance = async (updated: DailyAttendanceRecord[]) => {
    setAttendanceRecordsState(updated);
    saveAttendanceRecords(updated);
    try {
      await fetch('/api/sync/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) { console.error('Failed to sync attendance', e); }
  };

  // Reset to seed defaults or clean data
  const handleResetData = () => {
    clearAllDatabase();
    setStudentsState([]);
    setTabletsState([]);
    setBoxesState([]);
    setAssignmentsState([]);
    setAttendanceRecordsState([]);
    setIsAuditLogsOpen(false);
  };

  // Quick Assign Handlers
  const handleQuickAssignFromStudent = (student: Student) => {
    setPreselectedStudent(student);
    setPreselectedTablet(null);
    setActiveTab('assignments');
  };

  const handleQuickAssignFromTablet = (tablet: Tablet) => {
    setPreselectedTablet(tablet);
    setPreselectedStudent(null);
    setActiveTab('assignments');
  };

  if (!currentUser) {
    return (
      <LoginModal
        isOpen={true}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-color,#F8FAFC)] text-[var(--font-color,#0F172A)] font-sans antialiased selection:bg-indigo-600 selection:text-white flex">
      
      {/* Sidebar with Integrated Navigation, User Profile Badge & Quick Actions */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        currentUser={currentUser}
        activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
        setActiveRole={handleRoleChange}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onOpenUsersModal={() => setIsUsersModalOpen(true)}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onOpenLogout={() => setIsLogoutOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 p-4 sm:p-6 w-full min-h-screen ${
        sidebarCollapsed ? 'ml-16' : 'ml-16 sm:ml-64'
      }`}>
          
          {activeTab === 'dashboard' && (
            <DashboardView
              students={students}
              tablets={tablets}
              boxes={boxes}
              attendanceRecords={attendanceRecords}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'attendance' && (
            <DigitalAttendance
              students={students}
              attendanceRecords={attendanceRecords}
              onSaveAttendanceRecords={handleSaveAttendance}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'students' && (
            <StudentManagement
              students={students}
              onSaveStudents={handleSaveStudents}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
              onQuickAssignTablet={handleQuickAssignFromStudent}
            />
          )}

          {activeTab === 'boxes' && (
            <TabletBoxManagement
              boxes={boxes}
              tablets={tablets}
              students={students}
              onSaveBoxes={handleSaveBoxes}
              onSaveTablets={handleSaveTablets}
              onSaveStudents={handleSaveStudents}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'tablets' && (
            <TabletManagement
              tablets={tablets}
              students={students}
              boxes={boxes}
              onSaveTablets={handleSaveTablets}
              onSaveBoxes={handleSaveBoxes}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
              onQuickAssign={handleQuickAssignFromTablet}
            />
          )}

          {activeTab === 'assignments' && (
            <TabletAssignmentView
              assignments={assignments}
              students={students}
              tablets={tablets}
              onSaveAssignments={handleSaveAssignments}
              onSaveStudents={handleSaveStudents}
              onSaveTablets={handleSaveTablets}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
              preselectedStudentForAssign={preselectedStudent}
              preselectedTabletForAssign={preselectedTablet}
              onClearPreselections={() => {
                setPreselectedStudent(null);
                setPreselectedTablet(null);
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              students={students}
              tablets={tablets}
              boxes={boxes}
              attendanceRecords={attendanceRecords}
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              activeRole={activeRole}
              onNavigate={(tab) => setActiveTab(tab)}
              onRoleChange={handleRoleChange}
              onResetData={handleResetData}
            />
          )}

        </main>

      {/* Global Search Dialog */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* Security & Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
        onResetData={handleResetData}
      />

      {/* Centralized Theme Customization Modal */}
      <ThemeSettingsModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirmLogout={handleConfirmLogout}
        userName={currentUser?.fullName}
      />

      {/* System Users & Registration Modal */}
      <UserManagementModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        currentUser={currentUser}
      />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
