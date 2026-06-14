export const PAYMENT_METHODS = {
  credit_card: 'כרטיס אשראי',
  bank_transfer: 'העברה בנקאית',
  cash: 'מזומן',
  check: "צ'ק",
  paypal: 'PayPal',
  bit: 'ביט',
  other: 'אחר',
};

export const STATUS_MAP = {
  approved: { label: 'מאושר', color: 'bg-emerald-100 text-emerald-800' },
  missing_receipt: { label: 'חסרה קבלה', color: 'bg-red-100 text-red-700' },
  paid: { label: 'שולמה', color: 'bg-blue-100 text-blue-800' },
  gmail_inbox: { label: 'ממייל — טרם עובד', color: 'bg-violet-100 text-violet-800' },
  pending_approval: { label: 'ממתין לאישור', color: 'bg-amber-100 text-amber-800' },
  rejected: { label: 'נדחה', color: 'bg-gray-100 text-gray-600' },
};

export const DEAL_STATUS_MAP = {
  'פתוחה': { label: 'פתוחה', color: 'bg-blue-100 text-blue-800' },
  'סגורה': { label: 'סגורה', color: 'bg-gray-100 text-gray-600' },
};

export function computeDealStatus(deal) {
  if (!deal.commission_amount || deal.commission_amount <= 0) return 'פתוחה';
  return (deal.collected_actual || 0) >= deal.commission_amount ? 'סגורה' : 'פתוחה';
}

export const DOCUMENT_TYPES = {
  receipt: 'קבלה',
  invoice: 'חשבונית',
  tax_invoice: 'חשבונית מס',
  credit_note: 'זיכוי',
  other: 'אחר',
};

export const CURRENCY_SYMBOLS = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const formatCurrency = (amount, currency = 'ILS') => {
  const symbol = CURRENCY_SYMBOLS[currency] || '₪';
  const num = Number(amount) || 0;
  const formatted = Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${formatted} ${symbol}`;
};