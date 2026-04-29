export type StudentStatus = 'regular' | 'yatim' | 'keringanan' | 'keluar' | 'lulus' | 'pindahan';

export interface ArrearsDetail {
  months: number;
  monthlyRate: number;
  total: number;
}

export interface Student {
  id: string; // NIS
  nis: string;
  name: string;
  class: string;
  status: StudentStatus;
  discountAmount?: number;
  arrears: {
    class7: ArrearsDetail | number;
    class8: ArrearsDetail | number;
    class9: ArrearsDetail | number;
  };
  arrearsMonths: number;
  previousClasses?: {
    class7?: string;
    class8?: string;
  };
  isActive: boolean;
  isTransfer: boolean;
  transferDate?: string;
  ikutRekreasi?: boolean;
  customMonthlyAmount?: number;
  historicalAllocations?: AllocationItem[];
  historicalMonthlyAmount?: number;
  isAlumni?: boolean;
  graduatedYear?: string;
  createdAt: any;
}

export type PaymentType = 'full' | 'noRekreasi' | 'onlyRekreasi' | 'arrears';

export interface AllocationItem {
  id: string;
  name: string;
  amount: number;
  priority: number;
  isTabungan?: boolean;
}

export interface AcademicYear {
  id: string; // e.g., "2023_2024"
  label: string; // e.g., "2023/2024"
  isActive: boolean;
  createdAt: any;
  defaultMonthlyAmount: number;
  allocations: AllocationItem[];
}

export interface SystemSettings {
  id: string;
  adminEmails?: string[];
  cashierEmails: string[];
  supervisorEmails?: string[];
  currentAcademicYearId: string;
}

export const DEFAULT_ALLOCATIONS: AllocationItem[] = [
  { id: 'komite', name: 'Komite', amount: 85000, priority: 6 },
  { id: 'rekreasi', name: 'Tabungan', amount: 30000, priority: 5, isTabungan: true },
  { id: 'sarpras', name: 'Sarpras', amount: 10000, priority: 4 },
  { id: 'prestasi', name: 'Prestasi', amount: 10000, priority: 3 },
  { id: 'adiwiyata', name: 'Adiwiyata', amount: 10000, priority: 2 },
  { id: 'pramuka', name: 'Pramuka', amount: 5000, priority: 1 },
];

export interface Payment {
  id: string;
  studentId: string;
  studentNis?: string;
  studentName: string;
  studentClass: string;
  academicYearId: string;
  date: any;
  totalAmount: number;
  monthsCovered: number;
  type: PaymentType;
  arrearsClass?: 'class7' | 'class8' | 'class9';
  isPreviousBalance: boolean;
  allocations: Record<string, number>;
}

export interface Class {
  id: string;
  name: string;
  createdAt: any;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'default',
  adminEmails: ['m.alvin2564@admin.smp.belajar.id'],
  cashierEmails: [],
  supervisorEmails: [],
  currentAcademicYearId: '2023_2024'
};
