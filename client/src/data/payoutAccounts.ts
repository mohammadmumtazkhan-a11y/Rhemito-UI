export interface PayoutAccount {
  id: string;
  refNo: string;
  name: string;
  currency: string;
  bank: string;
  accountNumber: string;
  routingNumber: string;
  activated: boolean;
}

export const payoutAccounts: PayoutAccount[] = [
  { id: "1", refNo: "1105", name: "John Doe", currency: "NGN", bank: "Access Bank Nigeria Plc", accountNumber: "12312300011", routingNumber: "N/A", activated: true },
  { id: "2", refNo: "1106", name: "John Doe", currency: "GBP", bank: "Barclays", accountNumber: "12312300011", routingNumber: "20-45-67", activated: true },
  { id: "3", refNo: "1107", name: "John Doe", currency: "USD", bank: "Chase", accountNumber: "12312300011", routingNumber: "021000021", activated: true },
  { id: "4", refNo: "1108", name: "John Doe", currency: "EUR", bank: "Deutsche Bank", accountNumber: "DE89370400440532013000", routingNumber: "DEUTDEFF", activated: true },
];

export function getPayoutAccountByCurrency(currency: string): PayoutAccount | undefined {
  return payoutAccounts.find(a => a.currency === currency && a.activated);
}
