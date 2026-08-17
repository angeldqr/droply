import { db } from '../../platform/db';
import { invoice } from '../domain/invoice';

export const invoiceRepository = [db, invoice];
