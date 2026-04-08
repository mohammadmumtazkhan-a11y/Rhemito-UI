export interface KnownSender {
  senderType: "individual" | "business";
  firstName: string;
  middleName: string;
  lastName: string;
  businessName: string;
  email: string;
  countryCode: string;
  phone: string;
  dob: string;
  country: string;
  currency: string;
  relationship: string;
  createdAt: string;
  // Banking details
  bankName: string;
  accountNumber: string;
  sortCode: string;   // UK GBP — e.g. "20-45-67"
  iban: string;       // EUR / international
  swift: string;      // international BIC/SWIFT
  narration: string;  // optional; mandatory display for NGN
  serviceType: string;
}

export function resolveNarration(
  narration: string,
  relationship: string
): string {
  if (narration) return narration;
  const map: Record<string, string> = {
    business: "Business payment",
    personal: "Personal transfer",
    family: "Family support",
    friend: "Personal transfer",
    education: "School fees",
  };
  return map[relationship?.toLowerCase()] ?? "Money transfer";
}

export const knownSenders: KnownSender[] = [
  {
    senderType: "individual",
    firstName: "John",
    middleName: "Oluwaseun",
    lastName: "Adeyemi",
    businessName: "",
    email: "john.adeyemi@email.com",
    countryCode: "+234",
    phone: "8012345678",
    dob: "1985-03-15",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    createdAt: "2024-01-15",
    bankName: "Access Bank Nigeria Plc",
    accountNumber: "0123456789",
    sortCode: "",
    iban: "",
    swift: "",
    narration: "Business payment - January",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "individual",
    firstName: "Sarah",
    middleName: "",
    lastName: "Williams",
    businessName: "",
    email: "sarah.w@company.co.uk",
    countryCode: "+44",
    phone: "7700123456",
    dob: "1990-07-22",
    country: "United Kingdom",
    currency: "GBP",
    relationship: "Personal",
    createdAt: "2024-02-20",
    bankName: "Barclays",
    accountNumber: "12345678",
    sortCode: "20-45-67",
    iban: "",
    swift: "",
    narration: "",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "business",
    firstName: "",
    middleName: "",
    lastName: "",
    businessName: "Chen Technologies Ltd",
    email: "m.chen@business.com",
    countryCode: "+1",
    phone: "4155551234",
    dob: "",
    country: "United States",
    currency: "USD",
    relationship: "Business",
    createdAt: "2024-03-10",
    bankName: "Chase Bank",
    accountNumber: "987654321",
    sortCode: "",
    iban: "",
    swift: "CHASUS33",
    narration: "Invoice #CT-2024-031",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "individual",
    firstName: "Emma",
    middleName: "Grace",
    lastName: "Thompson",
    businessName: "",
    email: "emma.t@mail.com",
    countryCode: "+44",
    phone: "7891234567",
    dob: "1992-04-30",
    country: "United Kingdom",
    currency: "GBP",
    relationship: "Personal",
    createdAt: "2024-03-25",
    bankName: "HSBC",
    accountNumber: "87654321",
    sortCode: "40-47-84",
    iban: "",
    swift: "",
    narration: "",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "individual",
    firstName: "David",
    middleName: "Chukwu",
    lastName: "Okonkwo",
    businessName: "",
    email: "david.o@gmail.com",
    countryCode: "+234",
    phone: "9034567890",
    dob: "1987-09-12",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    createdAt: "2024-04-05",
    bankName: "GTBank",
    accountNumber: "0234567890",
    sortCode: "",
    iban: "",
    swift: "",
    narration: "",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "business",
    firstName: "",
    middleName: "",
    lastName: "",
    businessName: "Obi Enterprises",
    email: "amara.obi@outlook.com",
    countryCode: "+234",
    phone: "8123456789",
    dob: "",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Personal",
    createdAt: "2024-04-18",
    bankName: "Zenith Bank",
    accountNumber: "1098765432",
    sortCode: "",
    iban: "",
    swift: "",
    narration: "Consulting fee Q2",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "business",
    firstName: "",
    middleName: "",
    lastName: "",
    businessName: "Peterson Corp International",
    email: "j.peterson@corp.io",
    countryCode: "+1",
    phone: "2125559876",
    dob: "",
    country: "United States",
    currency: "USD",
    relationship: "Business",
    createdAt: "2024-05-02",
    bankName: "Bank of America",
    accountNumber: "112233445",
    sortCode: "",
    iban: "",
    swift: "BOFAUS3N",
    narration: "",
    serviceType: "Bank Deposit",
  },
  {
    senderType: "individual",
    firstName: "Fatima",
    middleName: "",
    lastName: "Hassan",
    businessName: "",
    email: "fatima.h@company.ng",
    countryCode: "+234",
    phone: "7056789012",
    dob: "1991-12-03",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    createdAt: "2024-05-15",
    bankName: "First Bank of Nigeria",
    accountNumber: "3012345678",
    sortCode: "",
    iban: "",
    swift: "",
    narration: "Monthly retainer",
    serviceType: "Bank Deposit",
  },
];
