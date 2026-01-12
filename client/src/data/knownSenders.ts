export interface KnownSender {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  dob: string;
  country: string;
  currency: string;
  relationship: string;
  entityType: string;
  createdAt: string;
}

export const knownSenders: KnownSender[] = [
  {
    firstName: "John",
    middleName: "Oluwaseun",
    lastName: "Adeyemi",
    email: "john.adeyemi@email.com",
    countryCode: "+234",
    phone: "8012345678",
    dob: "1985-03-15",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    entityType: "Individual",
    createdAt: "2024-01-15",
  },
  {
    firstName: "Sarah",
    middleName: "",
    lastName: "Williams",
    email: "sarah.w@company.co.uk",
    countryCode: "+44",
    phone: "7700123456",
    dob: "1990-07-22",
    country: "United Kingdom",
    currency: "GBP",
    relationship: "Personal",
    entityType: "Individual",
    createdAt: "2024-02-20",
  },
  {
    firstName: "Michael",
    middleName: "Wei",
    lastName: "Chen",
    email: "m.chen@business.com",
    countryCode: "+1",
    phone: "4155551234",
    dob: "1988-11-08",
    country: "United States",
    currency: "USD",
    relationship: "Business",
    entityType: "Individual",
    createdAt: "2024-03-10",
  },
  {
    firstName: "Emma",
    middleName: "Grace",
    lastName: "Thompson",
    email: "emma.t@mail.com",
    countryCode: "+44",
    phone: "7891234567",
    dob: "1992-04-30",
    country: "United Kingdom",
    currency: "GBP",
    relationship: "Personal",
    entityType: "Individual",
    createdAt: "2024-03-25",
  },
  {
    firstName: "David",
    middleName: "Chukwu",
    lastName: "Okonkwo",
    email: "david.o@gmail.com",
    countryCode: "+234",
    phone: "9034567890",
    dob: "1987-09-12",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    entityType: "Individual",
    createdAt: "2024-04-05",
  },
  {
    firstName: "Amara",
    middleName: "Ngozi",
    lastName: "Obi",
    email: "amara.obi@outlook.com",
    countryCode: "+234",
    phone: "8123456789",
    dob: "1995-01-25",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Personal",
    entityType: "Individual",
    createdAt: "2024-04-18",
  },
  {
    firstName: "James",
    middleName: "Robert",
    lastName: "Peterson",
    email: "j.peterson@corp.io",
    countryCode: "+1",
    phone: "2125559876",
    dob: "1983-06-18",
    country: "United States",
    currency: "USD",
    relationship: "Business",
    entityType: "Corporate",
    createdAt: "2024-05-02",
  },
  {
    firstName: "Fatima",
    middleName: "",
    lastName: "Hassan",
    email: "fatima.h@company.ng",
    countryCode: "+234",
    phone: "7056789012",
    dob: "1991-12-03",
    country: "Nigeria",
    currency: "NGN",
    relationship: "Business",
    entityType: "Individual",
    createdAt: "2024-05-15",
  },
];
