'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState('American');
  const [userRole, setUserRole] = useState('viewer');
  const [users, setUsers] = useState<any[]>([]);

  const fetchUsers = async () => {
    const usersSnap = await getDocs(collection(db, 'user_accounts'));
    setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    if (role === 'admin') {
      setTimeout(fetchUsers, 0);
    }
  }, [role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'user_accounts', username), {
        username,
        password,
        program,
        role: userRole
      });
      alert('User created successfully');
      setUsername('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (usernameToDelete === 'Admin') {
      alert('Cannot delete the primary Admin account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user ${usernameToDelete}?`)) return;

    try {
      // Delete from user_accounts
      await deleteDoc(doc(db, 'user_accounts', usernameToDelete));
      
      // Find and delete from users collection
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

  if (loading) return <Loader2 className="animate-spin" />;
  if (role !== 'admin') return <div>Access denied</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button 
          onClick={() => window.location.href = '/admin/audit'}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded border hover:bg-gray-200"
        >
          View Audit Logs
        </button>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New User</h2>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="text" placeholder="Username" required value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded" />
            <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" />
            <select value={program} onChange={e => setProgram(e.target.value)} className="w-full border p-2 rounded">
              <option value="All">All Programs</option>
              <option value="American">American</option>
              <option value="British">British</option>
              <option value="IB">IB</option>
            </select>
            <select value={userRole} onChange={e => setUserRole(e.target.value)} className="w-full border p-2 rounded">
              <option value="viewer">Viewer</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Create User</button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Manage Users</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{u.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.program}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {u.username !== 'Admin' && (
                      <button onClick={() => handleDeleteUser(u.username)} className="text-red-600 hover:text-red-900 inline-flex items-center">
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
