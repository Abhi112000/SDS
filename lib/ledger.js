export const LEDGER_TYPES = [
  'sale', 'sales_refund', 'credit_sale', 'customer_payment', 'supplier_purchase',
  'supplier_payment', 'market_purchase', 'expense', 'owner_withdrawal',
  'owner_reimbursement', 'owner_investment', 'other_receipt', 'other_payment',
  'adjustment', 'transfer'
];

export function ledgerDateBoundary(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcDay = Date.UTC(year, month - 1, day);
  const calendarDate = new Date(utcDay);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) return null;
  const dayOffset = endOfDay ? 86400000 : 0;
  return new Date(utcDay + dayOffset - 330 * 60000 - (endOfDay ? 1 : 0));
}

export function toPaise(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    value = value.toFixed(2);
  }
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [rupees, paise = ''] = value.trim().split('.');
  const amount = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function toSignedPaise(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    value = value.toFixed(2);
  }
  if (typeof value !== 'string' || !/^-?\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const negative = value.trim().startsWith('-');
  const unsigned = negative ? value.trim().slice(1) : value.trim();
  const [rupees, paise = ''] = unsigned.split('.');
  const amount = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? (negative ? -amount : amount) : null;
}

export function ledgerTransactionError(input) {
  if (!input || !LEDGER_TYPES.includes(input.type)) return 'Invalid transaction type';
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) return 'A valid transaction date is required';
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) return 'Amount must be greater than zero';
  const accountTypes = ['sale', 'sales_refund', 'customer_payment', 'supplier_payment', 'expense', 'owner_withdrawal', 'owner_reimbursement', 'other_receipt', 'other_payment'];
  if (accountTypes.includes(input.type) && !['cash', 'upi', 'bank', 'other'].includes(input.account)) return 'Select a valid payment account';
  if (input.type === 'credit_sale' && input.account !== 'credit') return 'Credit sales must use the credit account';
  if (input.type === 'transfer' && (!['cash', 'upi', 'bank', 'other'].includes(input.account) || !['cash', 'upi', 'bank', 'other'].includes(input.transferTo) || input.account === input.transferTo)) return 'Select two different valid transfer accounts';
  if (['owner_reimbursement', 'owner_investment'].includes(input.type) && !input.linkedTransactionId) return 'Link this entry to a market purchase';
  if (['credit_sale', 'customer_payment'].includes(input.type) && !input.partyId) return 'Select a customer';
  if (['supplier_purchase', 'supplier_payment'].includes(input.type) && !input.partyId) return 'Select a supplier';
  if (['supplier_purchase', 'market_purchase'].includes(input.type) && input.paidAmountPaise > input.amountPaise) return 'Paid amount cannot exceed purchase amount';
  return '';
}
