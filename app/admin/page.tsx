'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';

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
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;
  if (role !== 'admin') return <div>Access denied</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <form onSubmit={handleCreateUser} className="space-y-4 mb-8 bg-white p-4 shadow rounded">
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" />
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
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create User</button>
      </form>

      <h2 className="text-xl font-bold mb-4">Users</h2>
      <div className="bg-white shadow rounded p-4">
        {users.map(u => (
          <div key={u.id} className="border-b py-2">
            {u.username} - {u.role} - {u.program}
          </div>
        ))}
      </div>
    </div>
  );
}
