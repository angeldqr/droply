import { payInvoice } from '../application/pay-invoice';
import { invoiceRepository } from '../infrastructure/invoice.repository';

// El módulo es el composition root: acá sí se conocen a la vez el caso de uso
// y la implementación concreta que lo alimenta.
export const billingModule = [payInvoice, invoiceRepository];
