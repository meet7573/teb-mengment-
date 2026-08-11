import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  X, 
  CheckCircle2, 
  XCircle, 
  Search,
  Lock,
  UserCheck
} from 'lucide-react';
import { AppUser } from '../../utils/auth';
import { subscribeToCollection, syncCollection } from '../../lib/db';
import { UserRole } from '../../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  React.useEffect(() => {
    if (isOpen) {
      return subscribeToCollection<AppUser>('users', setUsers);
    }
  }, [isOpen]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // New User Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Admin');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const [formError, setFormError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string } | null>(null);

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.fullName?.toLowerCase()?.includes(search?.toLowerCase()) ||
      u.username?.toLowerCase()?.includes(search?.toLowerCase()) ||
      u.email?.toLowerCase()?.includes(search?.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !username.trim() || !email.trim() || !mobileNumber.trim() || !password) {
      setFormError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (users.some((u) => u.username?.toLowerCase() === username.trim()?.toLowerCase())) {
      setFormError('Username already exists. Please pick a unique username.');
      return;
    }

    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      mobileNumber: mobileNumber.trim(),
      role,
      status,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const updated = [newUser, ...users];
    syncCollection('users', users, updated);

    setIsAdding(false);
    setFullName('');
    setUsername('');
    setEmail('');
    setMobileNumber('');
    setPassword('');
    setConfirmPassword('');
    setRole('Admin');
    setStatus('Active');

    setToastMsg(`User ${newUser.fullName} registered successfully!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const toggleUserStatus = (id: string) => {
    const updated = users.map((u) => {
      if (u.id === id) {
        return { ...u, status: u.status === 'Active' ? ('Inactive' as const) : ('Active' as const) };
      }
      return u;
    });
    syncCollection('users', users, updated);
  };

  const handleDeleteUser = (id: string, name: string) => {
    setDeletingUser({ id, name });
  };

  const handleConfirmDeleteUser = () => {
    if (!deletingUser) return;
    const { id, name } = deletingUser;
    const updated = users.filter((u) => u.id !== id);
    syncCollection('users', users, updated);
    setToastMsg(`User ${name} removed.`);
    setTimeout(() => setToastMsg(''), 3000);
    setDeletingUser(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">System Users & Authentication Registry</h3>
              <p className="text-xs text-slate-500">Manage administrator, teacher, and operator access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="m-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, username, email..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 font-medium"
              />
            </div>

            {/* Add User button removed as users should register via Login page */}
          </div>

          {/* Registration Form Dropdown */}
          {/* Add User form removed */}

          {/* Users Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-600">
                  <th className="py-2.5 px-3">User & Username</th>
                  <th className="py-2.5 px-3">Contact Email & Phone</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      <div>{u.email}</div>
                      <div className="text-[10px] text-slate-400">{u.mobileNumber}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => toggleUserStatus(u.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          u.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {u.status}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.fullName)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs cursor-pointer hover:bg-slate-700"
          >
            Close Window
          </button>
        </div>

      </div>

      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 rounded-2xl border border-slate-200 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900">Remove User Account</h4>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove user account for <strong className="text-slate-900">{deletingUser.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
