import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export const logAudit = async (
  action: AuditAction,
  collectionName: string,
  documentId: string,
  details: any,
  username: string
) => {
  try {
    // Firestore does not support undefined values. Sanitize details.
    const sanitizedDetails = details ? JSON.parse(JSON.stringify(details)) : {};
    
    await addDoc(collection(db, 'audit_logs'), {
      action,
      collection: collectionName,
      documentId,
      details: sanitizedDetails,
      username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
