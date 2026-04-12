'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, Trash2, Edit2, X, Check, Plus } from 'lucide-react';

const DEFAULT_SUBJECTS = {
  core: ['English', 'Math', 'Science', 'French', 'German', 'Spanish', 'Humanities'],
  American: ['Social Studies'],
  British: ['Global Perspective'],
  IB: ['INS (Individuals & Societies)']
};

const AVAILABLE_PERMISSIONS = [
  { id: 'view', label: 'View' },
  { id: 'print', label: 'Print/Export' },
  { id: 'add_order', label: 'Add/Edit Orders' },
  { id: 'manage_users', label: 'Manage Users' }
];

export default function AdminDashboard() {
  const { user, role, permissions: userPermissions, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'subjects'>('users');
  
  // User Management State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState('American');
  const [userRole, setUserRole] = useState('viewer');
  const [permissions, setPermissions] = useState<string[]>(['view']);
  const [users, setUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editProgram, setEditProgram] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // Subject Management State
  const [subjects, setSubjects] = useState<any>(DEFAULT_SUBJECTS);
  const [newSubject, setNewSubject] = useState('');
  const [subjectCategory, setSubjectCategory] = useState('core');
  const [savingSubjects, setSavingSubjects] = useState(false);

  const fetchUsers = async () => {
    const usersSnap = await getDocs(collection(db, 'user_accounts'));
    setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchSubjects = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'subjects'));
      if (docSnap.exists()) {
        setSubjects(docSnap.data());
      } else {
        // Initialize if not exists
        await setDoc(doc(db, 'settings', 'subjects'), DEFAULT_SUBJECTS);
        setSubjects(DEFAULT_SUBJECTS);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  useEffect(() => {
    if (userPermissions.includes('manage_users') || role === 'admin') {
      fetchUsers();
      fetchSubjects();
    }
  }, [userPermissions, role]);

  const handleRoleChange = (newRole: string, isEdit: boolean) => {
    let defaultPerms = ['view'];
    if (newRole === 'admin') defaultPerms = ['view', 'print', 'add_order', 'manage_users'];
    else if (newRole === 'coordinator') defaultPerms = ['view', 'print', 'add_order'];
    
    if (isEdit) {
      setEditRole(newRole);
      setEditPermissions(defaultPerms);
    } else {
      setUserRole(newRole);
      setPermissions(defaultPerms);
    }
  };

  const togglePermission = (permId: string, isEdit: boolean) => {
    if (isEdit) {
      setEditPermissions(prev => 
        prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
      );
    } else {
      setPermissions(prev => 
        prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
      );
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'user_accounts', username), {
        username,
        password,
        program,
        role: userRole,
        permissions
      });
      alert('User created successfully');
      setUsername('');
      setPassword('');
      setPermissions(['view']);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  };

  const handleUpdateUser = async (usernameToUpdate: string) => {
    try {
      await updateDoc(doc(db, 'user_accounts', usernameToUpdate), {
        program: editProgram,
        role: editRole,
        permissions: editPermissions
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error updating user');
    }
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (usernameToDelete === 'Admin') {
      alert('Cannot delete the primary Admin account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user ${usernameToDelete}?`)) return;

    try {
      await deleteDoc(doc(db, 'user_accounts', usernameToDelete));
      const usersQuery = query(collection(db, 'users'), where('username', '==', usernameToDelete));
      const usersSnap = await getDocs(usersQuery);
      usersSnap.forEach(async (userDoc) => {
        await deleteDoc(doc(db, 'users', userDoc.id));
      });

      alert('User deleted successfully');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error deleting user');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    
    const updatedSubjects = { ...subjects };
    if (!updatedSubjects[subjectCategory]) {
      updatedSubjects[subjectCategory] = [];
    }
    if (!updatedSubjects[subjectCategory].includes(newSubject.trim())) {
      updatedSubjects[subjectCategory].push(newSubject.trim());
      setSubjects(updatedSubjects);
      saveSubjects(updatedSubjects);
    }
    setNewSubject('');
  };

  const handleRemoveSubject = async (category: string, subjectToRemove: string) => {
    const updatedSubjects = { ...subjects };
    updatedSubjects[category] = updatedSubjects[category].filter((s: string) => s !== subjectToRemove);
    setSubjects(updatedSubjects);
    saveSubjects(updatedSubjects);
  };

  const saveSubjects = async (subjectsToSave: any) => {
    setSavingSubjects(true);
    try {
      await setDoc(doc(db, 'settings', 'subjects'), subjectsToSave);
    } catch (err) {
      console.error("Error saving subjects:", err);
      alert("Failed to save subjects.");
    } finally {
      setSavingSubjects(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  if (!userPermissions.includes('manage_users') && role !== 'admin') return <div className="text-center p-12 text-red-600">Access denied</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <button 
          onClick={() => window.location.href = '/admin/audit'}
          className="bg-white text-gray-700 px-4 py-2 rounded-md border shadow-sm hover:bg-gray-50 font-medium"
        >
          View Audit Logs
        </button>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`${
              activeTab === 'subjects'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Subject Management
          </button>
        </nav>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8">
          <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <input type="text" placeholder="Username" required value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                <select value={program} onChange={e => setProgram(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  <option value="All">All Programs</option>
                  <option value="American">American</option>
                  <option value="British">British</option>
                  <option value="IB">IB</option>
                </select>
                <select value={userRole} onChange={e => handleRoleChange(e.target.value, false)} className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  <option value="viewer">Viewer</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-4">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id, false)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 font-medium transition-colors mt-4">Create User</button>
            </form>
          </div>

          <div className="bg-white shadow rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Manage Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingUser === u.username && u.username !== 'Admin' ? (
                          <select value={editRole} onChange={e => handleRoleChange(e.target.value, true)} className="border border-gray-300 rounded p-1 text-sm">
                            <option value="viewer">Viewer</option>
                            <option value="coordinator">Coordinator</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'coordinator' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingUser === u.username && u.username !== 'Admin' ? (
                          <select value={editProgram} onChange={e => setEditProgram(e.target.value)} className="border border-gray-300 rounded p-1 text-sm">
                            <option value="All">All Programs</option>
                            <option value="American">American</option>
                            <option value="British">British</option>
                            <option value="IB">IB</option>
                          </select>
                        ) : (
                          u.program
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        {editingUser === u.username && u.username !== 'Admin' ? (
                          <div className="flex flex-wrap gap-2">
                            {AVAILABLE_PERMISSIONS.map(perm => (
                              <label key={perm.id} className="inline-flex items-center text-xs">
                                <input
                                  type="checkbox"
                                  checked={editPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id, true)}
                                  className="rounded border-gray-300 text-blue-600 shadow-sm mr-1"
                                />
                                {perm.label}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(u.permissions || []).map((p: string) => (
                              <span key={p} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {u.username !== 'Admin' && (
                          <div className="flex justify-end space-x-3">
                            {editingUser === u.username ? (
                              <>
                                <button onClick={() => handleUpdateUser(u.username)} className="text-green-600 hover:text-green-900" title="Save">
                                  <Check className="h-5 w-5" />
                                </button>
                                <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700" title="Cancel">
                                  <X className="h-5 w-5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditingUser(u.username);
                                    setEditRole(u.role);
                                    setEditProgram(u.program);
                                    setEditPermissions(u.permissions || []);
                                  }} 
                                  className="text-blue-600 hover:text-blue-900" title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteUser(u.username)} className="text-red-600 hover:text-red-900" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-8">
          <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Add New Subject</h2>
              {savingSubjects && <span className="text-sm text-gray-500 flex items-center"><Loader2 className="animate-spin h-4 w-4 mr-2" /> Saving...</span>}
            </div>
            <form onSubmit={handleAddSubject} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category / Program</label>
                <select value={subjectCategory} onChange={e => setSubjectCategory(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  <option value="core">Core Subjects (All Programs)</option>
                  <option value="American">American</option>
                  <option value="British">British</option>
                  <option value="IB">IB</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                <input type="text" required value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Computer Science" className="w-full border border-gray-300 p-2.5 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 font-medium transition-colors flex items-center">
                <Plus className="h-5 w-5 mr-1" /> Add
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(subjects).map(([category, catSubjects]: [string, any]) => (
              <div key={category} className="bg-white shadow rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900 capitalize">
                    {category === 'core' ? 'Core Subjects' : `${category} Curriculum`}
                  </h3>
                  <span className="bg-gray-200 text-gray-700 py-0.5 px-2.5 rounded-full text-xs font-medium">
                    {catSubjects.length}
                  </span>
                </div>
                <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {catSubjects.length === 0 ? (
                    <li className="px-6 py-4 text-sm text-gray-500 text-center">No subjects added.</li>
                  ) : (
                    catSubjects.map((subject: string) => (
                      <li key={subject} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50">
                        <span className="text-sm text-gray-800">{subject}</span>
                        <button 
                          onClick={() => handleRemoveSubject(category, subject)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove subject"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
