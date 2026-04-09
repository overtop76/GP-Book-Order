'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const PROGRAMS = ['American', 'British', 'IB'] as const;

const GRADES = {
  American: ['KG1', 'KG2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  British: ['FS1', 'FS2', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'IG1', 'IG2', 'IG3'],
  IB: ['PYP1', 'PYP2', 'PYP3', 'PYP4', 'PYP5', 'PYP6', 'PYP7', 'PYP8', 'MYP1', 'MYP2', 'MYP3', 'MYP4', 'MYP5', 'DP1', 'DP2'],
};

const CORE_SUBJECTS = ['English', 'Math', 'Science', 'French', 'German', 'Spanish', 'Humanities'];

const PROGRAM_SUBJECTS = {
  American: ['Social Studies'],
  British: ['Global Perspective'],
  IB: ['INS (Individuals & Societies)'],
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

export default function AddOrder() {
  const { user, role, program: userProgram, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const currentStock = watch('currentStock');
  const projectedRequired = watch('projectedRequired');
  
  const orderQuantity = Math.max(0, (projectedRequired || 0) - (currentStock || 0));
  const overstockWarning = currentStock > projectedRequired;

  useEffect(() => {
    if (userProgram && userProgram !== 'All') {
      setValue('program', userProgram as any);
    }
  }, [userProgram, setValue]);

  useEffect(() => {
    // Reset grade and subject when program changes
    setValue('grade', '');
    setValue('subject', '');
  }, [selectedProgram, setValue]);

  const saveDraft = () => {
    const data = watch();
    localStorage.setItem('bookOrderDraft', JSON.stringify(data));
    alert('Draft saved!');
  };

  useEffect(() => {
    const draft = localStorage.getItem('bookOrderDraft');
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.keys(parsed).forEach(key => setValue(key as keyof FormData, parsed[key]));
    }
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    if (!data.isbn) {
      alert("Missing ISBN!");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'inventory_entries'), {
        ...data,
        orderQuantity,
        createdBy: user.displayName || 'unknown',
        createdAt: new Date().toISOString()
      });
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

  if (role === 'viewer') {
    return <div className="text-center py-12 text-red-600">You do not have permission to add orders.</div>;
  }

  const availableGrades = GRADES[selectedProgram];
  const availableSubjects = [...CORE_SUBJECTS, ...PROGRAM_SUBJECTS[selectedProgram]];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Add Book Order</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-white p-8 shadow rounded-lg">
        
        {/* Program & Grade */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Program</label>
            <select disabled={userProgram !== 'All' && role !== 'admin'} {...register('program')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border disabled:bg-gray-100 disabled:text-gray-500">
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Grade</label>
            <select {...register('grade')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              <option value="">Select Grade</option>
              {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {errors.grade && <p className="mt-1 text-sm text-red-600">{errors.grade.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <select {...register('subject')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              <option value="">Select Subject</option>
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.subject && <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Book Details */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Book Title</label>
            <input type="text" {...register('bookTitle')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            {errors.bookTitle && <p className="mt-1 text-sm text-red-600">{errors.bookTitle.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ISBN</label>
            <input type="text" {...register('isbn')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            {errors.isbn && <p className="mt-1 text-sm text-red-600">{errors.isbn.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Publisher (Optional)</label>
            <input type="text" {...register('publisher')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Format</label>
            <select {...register('format')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              <option value="Digital">Digital</option>
              <option value="Hard Copy">Hard Copy</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select {...register('type')} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              <option value="Student Copy">Student Copy</option>
              <option value="Teacher Edition">Teacher Edition</option>
              <option value="Resource Material">Resource Material</option>
            </select>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Quantities */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Stock</label>
            <input type="number" {...register('currentStock', { valueAsNumber: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            {errors.currentStock && <p className="mt-1 text-sm text-red-600">{errors.currentStock.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Projected Required</label>
            <input type="number" {...register('projectedRequired', { valueAsNumber: true })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            {errors.projectedRequired && <p className="mt-1 text-sm text-red-600">{errors.projectedRequired.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Order Quantity</label>
            <div className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-500 sm:text-sm">
              {orderQuantity}
            </div>
            {overstockWarning && <p className="mt-1 text-xs text-amber-600">Stock exceeds projection.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={saveDraft}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
