'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { logAudit } from '@/lib/audit';

const PROGRAMS = ['American', 'British', 'IB'] as const;

const GRADES = {
  American: ['KG1', 'KG2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  British: ['FS1', 'FS2', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'IG1', 'IG2', 'IG3'],
  IB: ['PYP1', 'PYP2', 'PYP3', 'PYP4', 'PYP5', 'PYP6', 'PYP7', 'PYP8', 'MYP1', 'MYP2', 'MYP3', 'MYP4', 'MYP5', 'DP1', 'DP2'],
};

const DEFAULT_SUBJECTS = {
  core: ['English', 'Math', 'Science', 'French', 'German', 'Spanish', 'Humanities'],
  American: ['Social Studies'],
  British: ['Global Perspective'],
  IB: ['INS (Individuals & Societies)']
};

const formSchema = z.object({
  program: z.enum(PROGRAMS),
  grade: z.string().min(1, "Grade is required"),
  subject: z.string().min(1, "Subject is required"),
  bookTitle: z.string().min(1, "Book title is required"),
  isbn: z.string().regex(/^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/, "Invalid ISBN format"),
  publisher: z.string().optional(),
  currentStock: z.number().min(0, "Stock cannot be negative"),
  projectedRequired: z.number().min(0, "Required copies cannot be negative"),
  format: z.enum(['Digital', 'Hard Copy', 'Both']),
  type: z.enum(['Student Copy', 'Teacher Edition', 'Resource Material']),
});

type FormData = z.infer<typeof formSchema>;

const SelectableCard = ({ selected, onClick, children, disabled = false }: any) => (
  <div
    onClick={disabled ? undefined : onClick}
    className={`
      relative cursor-pointer border rounded-lg p-4 text-center transition-all flex items-center justify-center min-h-[60px]
      ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-blue-300'}
      ${selected ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200'}
    `}
  >
    {selected && (
      <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-0.5">
        <Check className="w-3 h-3 text-white" />
      </div>
    )}
    <span className="font-medium">{children}</span>
  </div>
);

export default function AddOrder() {
  const { user, username, role, program: userProgram, permissions, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<any>(DEFAULT_SUBJECTS);

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      program: userProgram !== 'All' ? (userProgram as any) : 'American',
      currentStock: 0,
      projectedRequired: 0,
      format: 'Hard Copy',
      type: 'Student Copy'
    }
  });

  const selectedProgram = watch('program');
  const selectedGrade = watch('grade');
  const selectedSubject = watch('subject');
  const selectedFormat = watch('format');
  const selectedType = watch('type');
  const currentStock = watch('currentStock');
  const projectedRequired = watch('projectedRequired');
  const currentIsbn = watch('isbn');
  
  const orderQuantity = Math.max(0, (projectedRequired || 0) - (currentStock || 0));
  const overstockWarning = currentStock > projectedRequired;

  const handleISBNLookup = async () => {
    if (!currentIsbn) return;
    
    setIsLookingUp(true);
    try {
      const cleanIsbn = currentIsbn.replace(/[- ]/g, '');
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const bookInfo = data.items[0].volumeInfo;
        if (bookInfo.title) {
          setValue('bookTitle', bookInfo.title, { shouldValidate: true });
        }
        if (bookInfo.publisher) {
          setValue('publisher', bookInfo.publisher, { shouldValidate: true });
        }
      } else {
        alert('Book not found for this ISBN.');
      }
    } catch (error) {
      console.error('Error looking up ISBN:', error);
      alert('Failed to look up ISBN.');
    } finally {
      setIsLookingUp(false);
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
    if (userProgram && userProgram !== 'All') {
      setValue('program', userProgram as any);
    }
  }, [userProgram, setValue]);

  useEffect(() => {
    setValue('grade', '');
    setValue('subject', '');
    setIsCustomSubject(false);
    setCustomSubject('');
  }, [selectedProgram, setValue]);

  // Auto-save draft
  useEffect(() => {
    const subscription = watch((value) => {
      // Only save if we have some data
      if (value.bookTitle || value.isbn) {
        localStorage.setItem('bookOrderDraft', JSON.stringify(value));
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    const draft = localStorage.getItem('bookOrderDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        Object.keys(parsed).forEach(key => setValue(key as keyof FormData, parsed[key]));
        
        // Check if the loaded subject is a custom one
        const availableSubjects = [...(dbSubjects.core || []), ...(dbSubjects[parsed.program] || [])];
        if (parsed.subject && !availableSubjects.includes(parsed.subject)) {
          setIsCustomSubject(true);
          setCustomSubject(parsed.subject);
        }
      } catch (e) {
        console.error("Error parsing draft", e);
      }
    }
  }, [setValue, dbSubjects]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    if (!data.isbn) {
      alert("Missing ISBN!");
      return;
    }
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'inventory_entries'), {
        ...data,
        orderQuantity,
        createdBy: user.displayName || 'unknown',
        createdAt: new Date().toISOString()
      });
      
      await logAudit('CREATE', 'inventory_entries', docRef.id, { ...data, orderQuantity }, username || 'unknown');
      
      localStorage.removeItem('bookOrderDraft');
      router.push('/');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to add order. Check permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  if (!user) {
    return <div className="text-center py-12">Please sign in to add orders.</div>;
  }

  if (!permissions?.includes('add_order') && role !== 'admin' && role !== 'coordinator') {
    return <div className="text-center py-12 text-red-600">You do not have permission to add orders.</div>;
  }

  const availableGrades = GRADES[selectedProgram] || [];
  const availableSubjects = [...(dbSubjects.core || []), ...(dbSubjects[selectedProgram] || [])];

  const handleCustomSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSubject(e.target.value);
    setValue('subject', e.target.value, { shouldValidate: true });
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Book Order</h1>
        <span className="text-sm text-gray-500 italic">Draft auto-saves as you type</span>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 bg-white p-8 shadow rounded-xl">
        
        {/* Program Selection */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-4">Curriculum Program</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PROGRAMS.map(p => (
              <SelectableCard
                key={p}
                selected={selectedProgram === p}
                onClick={() => setValue('program', p)}
                disabled={userProgram !== 'All' && role !== 'admin' && userProgram !== p}
              >
                <div className="flex flex-col">
                  <span className="text-lg">{p}</span>
                  <span className="text-sm opacity-70">Curriculum</span>
                </div>
              </SelectableCard>
            ))}
          </div>
        </div>

        {/* Grade Selection */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-4">Grade Level</label>
          <div className="flex flex-wrap gap-3">
            {availableGrades.map(g => (
              <div key={g} className="w-20">
                <SelectableCard
                  selected={selectedGrade === g}
                  onClick={() => setValue('grade', g, { shouldValidate: true })}
                >
                  {g}
                </SelectableCard>
              </div>
            ))}
          </div>
          {errors.grade && <p className="mt-2 text-sm text-red-600">{errors.grade.message}</p>}
        </div>

        {/* Subject Selection */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-4">Subject</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {availableSubjects.map(s => (
              <SelectableCard
                key={s}
                selected={selectedSubject === s && !isCustomSubject}
                onClick={() => {
                  setIsCustomSubject(false);
                  setValue('subject', s, { shouldValidate: true });
                }}
              >
                {s}
              </SelectableCard>
            ))}
            <SelectableCard
              selected={isCustomSubject}
              onClick={() => {
                setIsCustomSubject(true);
                setValue('subject', customSubject, { shouldValidate: true });
              }}
            >
              Other (Custom)
            </SelectableCard>
          </div>
          
          {isCustomSubject && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter Custom Subject</label>
              <input 
                type="text" 
                value={customSubject}
                onChange={handleCustomSubjectChange}
                placeholder="e.g. Computer Science"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
              />
            </div>
          )}
          {errors.subject && <p className="mt-2 text-sm text-red-600">{errors.subject.message}</p>}
        </div>

        <hr className="border-gray-200" />

        {/* Book Details */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-4">Book Details</label>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Book Title</label>
              <input type="text" {...register('bookTitle')} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              {errors.bookTitle && <p className="mt-1 text-sm text-red-600">{errors.bookTitle.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
              <div className="flex gap-2">
                <input type="text" {...register('isbn')} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                <button 
                  type="button" 
                  onClick={handleISBNLookup}
                  disabled={isLookingUp || !currentIsbn}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLookingUp ? <Loader2 className="animate-spin h-4 w-4" /> : 'Lookup'}
                </button>
              </div>
              {errors.isbn && <p className="mt-1 text-sm text-red-600">{errors.isbn.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publisher (Optional)</label>
              <input type="text" {...register('publisher')} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>
          </div>
        </div>

        {/* Format and Type */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {['Digital', 'Hard Copy', 'Both'].map(f => (
                <SelectableCard
                  key={f}
                  selected={selectedFormat === f}
                  onClick={() => setValue('format', f as any)}
                >
                  <span className="text-sm">{f}</span>
                </SelectableCard>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['Student Copy', 'Teacher Edition', 'Resource Material'].map(t => (
                <SelectableCard
                  key={t}
                  selected={selectedType === t}
                  onClick={() => setValue('type', t as any)}
                >
                  <span className="text-xs leading-tight">{t}</span>
                </SelectableCard>
              ))}
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Quantities */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-4">Inventory & Ordering</label>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
              <input type="number" {...register('currentStock', { valueAsNumber: true })} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              {errors.currentStock && <p className="mt-1 text-sm text-red-600">{errors.currentStock.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projected Required</label>
              <input type="number" {...register('projectedRequired', { valueAsNumber: true })} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              {errors.projectedRequired && <p className="mt-1 text-sm text-red-600">{errors.projectedRequired.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Quantity</label>
              <div className="block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 font-semibold sm:text-sm">
                {orderQuantity}
              </div>
              {overstockWarning && <p className="mt-1 text-xs text-amber-600">Stock exceeds projection.</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('bookOrderDraft');
              router.push('/');
            }}
            className="inline-flex justify-center py-2.5 px-5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
