'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logAudit } from '@/lib/audit';

const GRADES: Record<string, string[]> = {
  American: ['KG1', 'KG2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  British: ['FS1', 'FS2', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'IG1', 'IG2', 'IG3'],
  IB: ['PYP1', 'PYP2', 'PYP3', 'PYP4', 'PYP5', 'PYP6', 'PYP7', 'PYP8', 'MYP1', 'MYP2', 'MYP3', 'MYP4', 'MYP5', 'DP1', 'DP2'],
};

interface InventoryEntry {
  id: string;
  program: string;
  grade: string;
  subject: string;
  bookTitle: string;
  isbn: string;
  publisher: string;
  currentStock: number;
  nextYearStudents?: number;
  projectionPercentage?: number;
  projectedRequired: number;
  orderQuantity: number;
  format: string;
  type: string;
}

export default function Dashboard() {
  const { user, username: authUsername, role, program: userProgram, permissions, loading, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [dbSubjects, setDbSubjects] = useState<any>({});

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signIn(username, password);
    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.message || 'Invalid username or password');
    }
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'subjects'));
        if (docSnap.exists()) {
          setDbSubjects(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching subjects:", err);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (!user || !role || !userProgram) {
      return;
    }

    let q;
    if (role === 'admin' || userProgram === 'All') {
      q = query(collection(db, 'inventory_entries'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'inventory_entries'), where('program', '==', userProgram), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryEntry[];
      setEntries(data);
      setFetching(false);
    }, (error) => {
      console.error("Error fetching entries:", error);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [user, role, userProgram]);

  const handleProgramChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterProgram(e.target.value);
    setFilterGrade('All');
    setFilterSubject('All');
  };

  if (loading || (user && !role) || (user && role && fetching)) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  const filteredEntries = entries.filter(e => {
    if (filterProgram !== 'All' && e.program !== filterProgram) return false;
    if (filterGrade !== 'All' && e.grade !== filterGrade) return false;
    if (filterSubject !== 'All' && e.subject !== filterSubject) return false;
    return true;
  }).sort((a, b) => {
    const programCompare = a.program.localeCompare(b.program);
    if (programCompare !== 0) return programCompare;
    
    const gradesForProgram = GRADES[a.program] || [];
    const indexA = gradesForProgram.indexOf(a.grade);
    const indexB = gradesForProgram.indexOf(b.grade);
    
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    return a.grade.localeCompare(b.grade);
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredEntries.map(e => ({
      Program: e.program,
      Grade: e.grade,
      Subject: e.subject,
      'Book Title': e.bookTitle,
      ISBN: e.isbn,
      Publisher: e.publisher || '',
      'Next Year Students': e.nextYearStudents || 0,
      'Projection %': `${e.projectionPercentage || 0}%`,
      'Projected Required': e.projectedRequired,
      'Current Stock': e.currentStock,
      'Final Order Quantity': e.orderQuantity,
      Format: e.format,
      Type: e.type
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Book Orders");
    XLSX.writeFile(workbook, "Book_Orders.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text("Book Order Summary", 14, 15);
    
    const tableColumn = ["Program", "Grade", "Subject", "Book Title", "ISBN", "Publisher", "Students", "Proj %", "Required", "Stock", "Final Qty", "Format", "Type"];
    const tableRows = filteredEntries.map(e => [
      e.program,
      e.grade,
      e.subject,
      e.bookTitle,
      e.isbn,
      e.publisher || '',
      (e.nextYearStudents || 0).toString(),
      `${e.projectionPercentage || 0}%`,
      e.projectedRequired.toString(),
      e.currentStock.toString(),
      e.orderQuantity.toString(),
      e.format,
      e.type
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save("Book_Orders.pdf");
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        const entryToDelete = entries.find(e => e.id === id);
        await deleteDoc(doc(db, 'inventory_entries', id));
        if (entryToDelete) {
          await logAudit('DELETE', 'inventory_entries', id, entryToDelete, authUsername || 'unknown');
        }
      } catch (err) {
        console.error('Error deleting entry:', err);
        alert('Failed to delete entry. Check permissions.');
      }
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to BookManager</h2>
        <form onSubmit={handleSignIn} className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" />
          {error && <p className="text-red-500">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  const canPrint = permissions?.includes('print') || role === 'admin' || role === 'coordinator';
  const canAddOrder = permissions?.includes('add_order') || role === 'admin' || role === 'coordinator';

  const availableGrades = filterProgram !== 'All' ? GRADES[filterProgram] || [] : [];
  const availableSubjects = filterProgram !== 'All' ? [...(dbSubjects.core || []), ...(dbSubjects[filterProgram] || [])] : [];

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">Overview of all book orders across programs.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-3 items-center justify-end">
          <select
            value={filterProgram}
            onChange={handleProgramChange}
            disabled={userProgram !== 'All' && role !== 'admin'}
            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-100 disabled:text-gray-500"
          >
            {(role === 'admin' || userProgram === 'All') && <option value="All">All Programs</option>}
            <option value="American">American</option>
            <option value="British">British</option>
            <option value="IB">IB</option>
          </select>
          
          {filterProgram !== 'All' && (
            <>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="All">All Grades</option>
                {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="All">All Subjects</option>
                {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}

          {canPrint && (
            <>
              <button
                onClick={exportToExcel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                Excel
              </button>
              <button
                onClick={exportToPDF}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2 text-red-600" />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Books Required</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {filteredEntries.reduce((sum, e) => sum + e.projectedRequired, 0)}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Current Stock</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {filteredEntries.reduce((sum, e) => sum + e.currentStock, 0)}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Order Quantity</dt>
            <dd className="mt-1 text-3xl font-semibold text-blue-600">
              {filteredEntries.reduce((sum, e) => sum + e.orderQuantity, 0)}
            </dd>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program / Grade</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Details</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students / Proj %</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock / Req</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Qty</th>
                    {canAddOrder && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{entry.program}</div>
                        <div className="text-sm text-gray-500">{entry.grade}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {entry.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{entry.bookTitle}</div>
                        <div className="text-sm text-gray-500">ISBN: {entry.isbn}</div>
                        <div className="text-xs text-gray-400">{entry.format} • {entry.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="text-gray-900">{entry.nextYearStudents || 0}</div>
                        <div className="text-gray-500">{entry.projectionPercentage || 0}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.currentStock} / {entry.projectedRequired}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.orderQuantity > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {entry.orderQuantity}
                        </span>
                      </td>
                      {canAddOrder && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                          <button onClick={() => window.location.href = `/edit/${entry.id}`} className="text-blue-600 hover:text-blue-900">Edit</button>
                          <button onClick={() => handleDelete(entry.id)} className="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={canAddOrder ? 7 : 6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
