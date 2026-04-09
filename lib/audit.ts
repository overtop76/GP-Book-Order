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
    await addDoc(collection(db, 'audit_logs'), {
      action,
      collection: collectionName,
      documentId,
      details,
      username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
