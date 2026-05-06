/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  LogOut, 
  Plus, 
  Search, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  UserPlus,
  History,
  LayoutDashboard,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Download,
  Upload,
  FileText,
  X,
  Trash2,
  Menu,
  ChevronLeft,
  WifiOff
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { cn, formatCurrency } from './lib/utils';
import { 
  Student, 
  Payment, 
  Class,
  StudentStatus, 
  PaymentType, 
  AllocationItem,
  SystemSettings,
  AcademicYear,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_ALLOCATIONS
} from './types';

// --- Components ---

function Sidebar({ activeTab, setActiveTab, user, isCashier, isSupervisor, selectedYear, onYearChange, isHidden, onToggle }: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  user: User | null, 
  isCashier: boolean,
  isSupervisor?: boolean,
  selectedYear: string | null,
  onYearChange: () => void,
  isHidden: boolean,
  onToggle: () => void
}) {
  let menuItems = [
    { id: 'dashboard', label: 'Ringkasan Dasbor', icon: LayoutDashboard, adminOnly: true },
    { id: 'classes', label: 'Manajemen Kelas', icon: SettingsIcon, adminOnly: true },
    { id: 'students', label: 'Daftar Siswa', icon: Users, adminOnly: true },
    { id: 'payment', label: 'Input Pembayaran', icon: CreditCard, adminOnly: false },
    { id: 'reports', label: 'Laporan Keuangan', icon: BarChart3, adminOnly: true },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon, adminOnly: true },
  ];

  if (isSupervisor) {
    menuItems = menuItems.filter(item => item.id === 'reports');
  } else if (isCashier) {
    menuItems = menuItems.filter(item => !item.adminOnly);
  }

  return (
    <aside className={cn(
      "sidebar-container",
      isHidden ? "-translate-x-full" : "translate-x-0"
    )}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-8">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c940]" />
          </div>
          <button 
            onClick={onToggle}
            className="btn-ghost p-1 rounded-md transition-colors"
            title="Sembunyikan Menu"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-text-main">KOMITE</h1>
        <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wider font-semibold">SMP Negeri 2 Turen</p>
        
        {selectedYear && (
          <div className="mt-4 p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 uppercase">TA {selectedYear.replace('_', '/')}</span>
            {!isCashier && (
              <button 
                onClick={onYearChange}
                className="text-[10px] text-blue-600 hover:underline font-bold uppercase outline-none"
              >
                Ganti
              </button>
            )}
          </div>
        )}
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "sidebar-link w-full",
              activeTab === item.id 
                ? "sidebar-link-active" 
                : "sidebar-link-inactive"
            )}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-3 mb-2">
          {isCashier ? (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Users size={16} />
            </div>
          ) : (
            <img src={user?.photoURL || ''} alt="" className="w-8 h-8 rounded-full bg-slate-200" referrerPolicy="no-referrer" />
          )}
          <div className="overflow-hidden">
            <p className="text-[13px] font-semibold truncate text-text-main">{isCashier ? 'Petugas Penerima Pembayaran' : user?.displayName}</p>
            <p className="text-[11px] text-text-muted truncate">{isCashier ? 'Entry Only' : 'Administrator'}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            signOut(auth).then(() => {
              if (isCashier) {
                window.location.reload();
              }
            });
          }}
          className="sidebar-link w-full text-text-muted hover:text-red-500 hover:bg-red-50"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}

// --- Helpers ---

const getAcademicYear = (date: Date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const getExpectedMonths = (activeYearId: string) => {
  if (!activeYearId) return 12;
  const parts = activeYearId.split('_');
  if (parts.length !== 2) return 12;
  const startYear = parseInt(parts[0]);
  const startDate = new Date(startYear, 6, 1); // July 1st
  const now = new Date();
  if (now < startDate) return 0;
  
  const months = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1;
  return Math.max(0, Math.min(12, months));
};

const getArrearsDisplay = (student: Student, classGrade: 'class7'|'class8'|'class9', activeYearId: string) => {
  const detail = student.arrears?.[classGrade];
  if (!detail) return { total: 0, months: 0 };
  const totalDebt12 = typeof detail === 'number' ? detail : detail.total || 0;
  const monthlyRate = typeof detail === 'number' ? 150000 : detail.monthlyRate || 150000;
  
  if (student.isAlumni || student.status === 'lulus') {
      return {
          total: totalDebt12,
          months: typeof detail === 'number' ? (monthlyRate > 0 ? totalDebt12 / monthlyRate : 0) : detail.months || 0
      };
  }

  const currentClassPrefix = student.class ? student.class.charAt(0) : '';
  const isCurrentClass = currentClassPrefix === classGrade.replace('class', '');
  
  if (isCurrentClass && activeYearId) {
      const expectedMonths = getExpectedMonths(activeYearId);
      let currentOwed = totalDebt12 - ((12 - expectedMonths) * monthlyRate);
      currentOwed = Math.max(0, currentOwed);
      return {
          total: currentOwed,
          months: monthlyRate > 0 ? currentOwed / monthlyRate : 0
      };
  } else {
      return {
          total: totalDebt12,
          months: typeof detail === 'number' ? (monthlyRate > 0 ? totalDebt12 / monthlyRate : 0) : detail.months || 0
      };
  }
};

const getTotalArrearsDisplay = (student: Student, activeYearId: string) => {
  const c7 = getArrearsDisplay(student, 'class7', activeYearId);
  const c8 = getArrearsDisplay(student, 'class8', activeYearId);
  const c9 = getArrearsDisplay(student, 'class9', activeYearId);
  return {
      total: c7.total + c8.total + c9.total,
      months: c7.months + c8.months + c9.months
  };
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [alumni, setAlumni] = useState<Student[]>([]);
  const [isYearSelectionOpen, setIsYearSelectionOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [estimatedDbSize, setEstimatedDbSize] = useState<number>(0);

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Derived state from Firebase user and settings
  const checkIsAdmin = () => {
    if (!user) return false;
    // Default master admin
    if (user.email === "m.alvin2564@admin.smp.belajar.id") return true;
    return settings?.adminEmails?.includes(user.email || '') || false;
  };
  
  const isAdmin = checkIsAdmin();
  const isCashierAuthenticated = settings?.cashierEmails?.includes(user?.email || '');
  const isSupervisorAuthenticated = settings?.supervisorEmails?.includes(user?.email || '');
  const isAuthorized = isAdmin || isCashierAuthenticated || isSupervisorAuthenticated;

  useEffect(() => {
    if (isAuthorized && !isAdmin && !isCashierAuthenticated && isSupervisorAuthenticated) {
      setActiveTab('reports');
    }
  }, [isAdmin, isCashierAuthenticated, isSupervisorAuthenticated, isAuthorized]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u && !u.isAnonymous ? u : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubAlumni = onSnapshot(collection(db, 'alumni'), (snap) => {
      setAlumni(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), isAlumni: true } as Student)));
    }, (err) => {
      console.error("Alumni snapshot error:", err);
    });

    return () => {
      unsubAlumni();
    };
  }, [user]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return; // Wait until a user is present to listen to settings (or if we want public read, we can just do it unconditionally)

    // Actually, settings should be readable by all authenticated users
    const unsubSettings = onSnapshot(doc(db, 'settings', 'defaults'), (snapshot) => {
      try {
        if (snapshot.exists()) {
          const newData = { id: snapshot.id, ...snapshot.data() } as SystemSettings;
          setSettings(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
            return newData;
          });
          // Set initial selected year for admin if not already set
          if (user && !selectedYearId) {
            setSelectedYearId(newData.currentAcademicYearId);
          }
          // Cashier/Supervisor always uses the active year from settings
          if (isCashierAuthenticated || isSupervisorAuthenticated) {
            setSelectedYearId(newData.currentAcademicYearId);
          }
        } else if (user?.email === "m.alvin2564@admin.smp.belajar.id") {
          // Initialize settings if not exists (Admin only)
          setDoc(doc(db, 'settings', 'defaults'), DEFAULT_SYSTEM_SETTINGS).catch(err => {
            console.error("Failed to initialize settings:", err);
          });
        }
      } catch (err) {
        console.error("Error processing settings snapshot:", err);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/defaults', false);
      setError("Gagal memuat pengaturan sistem. Pastikan koneksi internet stabil.");
    });

    const qYears = query(collection(db, 'academic_years'), orderBy('createdAt', 'desc'));
    const unsubYears = onSnapshot(qYears, (snapshot) => {
      try {
        const years = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          
          if (isAdmin && (!data.allocations || !data.defaultMonthlyAmount)) {
            updateDoc(doc(db, 'academic_years', docSnap.id), {
              defaultMonthlyAmount: data.defaultMonthlyAmount || 150000,
              allocations: data.allocations || DEFAULT_ALLOCATIONS
            }).catch(console.error);
          }

          return { 
            id: docSnap.id, 
            ...data,
            defaultMonthlyAmount: data.defaultMonthlyAmount || 150000,
            allocations: data.allocations || DEFAULT_ALLOCATIONS
          } as AcademicYear;
        });
        setAcademicYears(years);
        
        // If no years exist, create the default one (Admin only)
        if (years.length === 0 && user?.email === "m.alvin2564@admin.smp.belajar.id") {
          const defaultYear: AcademicYear = {
            id: '2023_2024',
            label: '2023/2024',
            isActive: true,
            createdAt: serverTimestamp(),
            defaultMonthlyAmount: 150000,
            allocations: DEFAULT_ALLOCATIONS
          };
          setDoc(doc(db, 'academic_years', defaultYear.id), defaultYear).catch(err => {
            console.error("Failed to initialize default year:", err);
          });
        }
      } catch (err) {
        console.error("Error processing years snapshot:", err);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'academic_years', false);
      setError("Gagal memuat data tahun ajaran.");
    });

    return () => {
      unsubSettings();
      unsubYears();
    };
  }, [user, isCashierAuthenticated, selectedYearId]);

  useEffect(() => {
    if (!user && !isCashierAuthenticated) return;
    if (!selectedYearId) return;

    const yearRef = doc(db, 'academic_years', selectedYearId);
    
    const qStudents = query(collection(yearRef, 'students'), orderBy('name'));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `academic_years/${selectedYearId}/students`, false);
    });

    const qPayments = query(collection(yearRef, 'payments'), orderBy('date', 'desc'));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `academic_years/${selectedYearId}/payments`, false);
    });

    const qClasses = query(collection(yearRef, 'classes'), orderBy('name'));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `academic_years/${selectedYearId}/classes`, false);
    });

    return () => {
      unsubStudents();
      unsubPayments();
      unsubClasses();
    };
  }, [user, isCashierAuthenticated, selectedYearId]);

  useEffect(() => {
    if (user && !selectedYearId && !isYearSelectionOpen && academicYears.length > 0) {
      setIsYearSelectionOpen(true);
    }
  }, [user, selectedYearId, isYearSelectionOpen, academicYears]);

  useEffect(() => {
    // Estimasi ukuran memori data yang sedang dimuat
    if (!students && !payments && !classes && !academicYears) return;
    
    // Gunakan try-catch agar aplikasi tidak crash jika data terlalu besar
    try {
      const dataObj = { students, payments, classes, academicYears, alumni, settings };
      const jsonString = JSON.stringify(dataObj);
      const sizeInBytes = new TextEncoder().encode(jsonString).length;
      setEstimatedDbSize(sizeInBytes);
    } catch (e) {
      console.warn("Failed to calculate estimated memory size");
    }
  }, [students, payments, classes, academicYears, alumni, settings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, usernameInput, passwordInput);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setLoginError('Username atau password salah.');
      } else {
        setLoginError(error.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    const provider = new GoogleAuthProvider();
    try {
      // First try popup (works on web)
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Popup login failed, attempting redirect strategy...", error);
      // In electron/capacitor this fails with unauthorized-domain
      if (error && error.code === 'auth/unauthorized-domain') {
         try {
           await signInWithRedirect(auth, provider);
         } catch(err) {
            console.error("Redirect login also failed", err);
            setLoginError("Secara bawaan, metode Login Google mode Popup tidak diizinkan di jendela ini. Mohon gunakan Browser/Web agar metode Google berjalan lancar, atau gunakan Username/Sandi yang telah didaftarkan.");
         }
      } else {
         setLoginError("Google Login gagal: " + error.message);
      }
    }
  };

  const allStudents = useMemo(() => {
    const studentMap = new Map<string, Student>();
    alumni.forEach(s => studentMap.set(s.id, s));
    students.forEach(s => studentMap.set(s.id, s));
    return Array.from(studentMap.values());
  }, [students, alumni]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full content-card p-8">
          <div className="w-16 h-16 bg-blue-100 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CreditCard size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-main mb-2 text-center">Komite SMP Negeri 2 Turen</h1>
          <p className="text-text-muted mb-8 text-sm text-center">Silakan masuk menggunakan Username dan Password.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Username</label>
              <input 
                type="text" 
                required
                className="input-field" 
                placeholder="Masukkan username"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Password</label>
              <input 
                type="password" 
                required
                className="input-field" 
                placeholder="••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full btn btn-primary py-3 mt-2"
            >
              Masuk
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-text-muted text-xs font-medium uppercase tracking-wider">atau</span>
              <div className="flex-grow border-t border-border"></div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full btn btn-secondary flex items-center justify-center gap-3 py-3"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
              Masuk dengan Google
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full content-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CreditCard size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-main mb-2">Akses Ditolak</h1>
          <p className="text-text-muted mb-8 text-sm">Anda tidak memiliki hak akses sebagai Administrator, Kasir, atau Supervisor. Hubungi Administrator untuk didaftarkan.</p>
          <p className="text-sm text-text-muted mb-6 font-mono bg-slate-100 p-2 rounded">{user.email}</p>
          <button
            onClick={() => signOut(auth)}
            className="w-full btn btn-secondary py-3"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Removed state update from render body

  if (user && isYearSelectionOpen) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full content-card p-8">
          <div className="w-16 h-16 bg-blue-100 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
            <History size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-main mb-2 text-center">Pilih Tahun Ajaran</h1>
          <p className="text-text-muted mb-8 text-center text-sm">Silakan pilih database tahun ajaran yang ingin Anda kelola.</p>
          
          <div className="space-y-3">
            {academicYears.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4"></div>
                <p className="text-sm text-text-muted">Memuat data tahun ajaran...</p>
              </div>
            ) : (
              academicYears.map(year => (
                <button
                  key={year.id}
                  onClick={() => {
                    setSelectedYearId(year.id);
                    setIsYearSelectionOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-4 rounded-xl font-semibold transition-all duration-200 border",
                    year.id === settings.currentAcademicYearId 
                      ? "bg-blue-50 border-blue-200 text-blue-700" 
                      : "bg-white border-border text-text-main hover:bg-slate-50"
                  )}
                >
                  <span>Tahun Ajaran {year.label}</span>
                  {year.id === settings.currentAcademicYearId && (
                    <span className="badge badge-blue">Aktif</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        isCashier={isCashierAuthenticated}
        isSupervisor={isSupervisorAuthenticated && !isAdmin && !isCashierAuthenticated}
        selectedYear={selectedYearId}
        onYearChange={() => setIsYearSelectionOpen(true)}
        isHidden={isSidebarHidden}
        onToggle={() => setIsSidebarHidden(!isSidebarHidden)}
      />
      
      <main className={cn(
        "main-content relative",
        isSidebarHidden ? "ml-0" : "ml-[var(--sidebar-width,240px)]"
      )}>
        {!isOnline && (
           <div className="absolute top-0 left-0 right-0 z-[100] bg-rose-500 text-white text-[11px] font-bold tracking-wider uppercase text-center py-1.5 flex items-center justify-center gap-2 shadow-sm animate-in slide-in-from-top-full">
               <WifiOff size={14} /> Anda sedang OFFLINE. Data akan tersimpan di perangkat sementara dan otomatis disinkronisasi ketika ONLINE.
           </div>
        )}
        
        {isSidebarHidden && (
          <button 
            onClick={() => setIsSidebarHidden(false)}
            className="fixed left-4 top-4 z-[60] btn-secondary p-2 shadow-sm"
            title="Tampilkan Menu"
          >
            <Menu size={20} />
          </button>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-semibold text-text-main tracking-tight">
              {activeTab === 'dashboard' && 'Ringkasan Sistem'}
              {activeTab === 'classes' && 'Manajemen Kelas'}
              {activeTab === 'students' && 'Daftar Siswa'}
              {activeTab === 'payment' && 'Proses Pembayaran'}
              {activeTab === 'reports' && 'Analisis Keuangan'}
              {activeTab === 'settings' && 'Pengaturan Sistem'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-text-muted">
                {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
              </p>
              {academicYears.find(y => y.id === selectedYearId) && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                  Tahun {academicYears.find(y => y.id === selectedYearId)?.label}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="flex flex-col items-end gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
                {isOnline ? 'Online (Tersinkronisasi)' : 'Mode Offline'}
              </div>
              {estimatedDbSize > 0 && (
                <div className="text-[10px] items-center text-text-muted font-bold flex gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-sm bg-slate-400"></span> 
                  Memory Terpakai: {estimatedDbSize > 1024 * 1024 ? (estimatedDbSize / (1024 * 1024)).toFixed(2) + ' MB' : (estimatedDbSize / 1024).toFixed(2) + ' KB'}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {(() => {
            const activeYear = academicYears.find(y => y.id === selectedYearId);
            if (!activeYear && activeTab !== 'settings') return <div className="text-center py-10 text-slate-500">Memuat data tahun ajaran...</div>;
            return (
              <>
                {activeTab === 'dashboard' && <DashboardView students={students} payments={payments} activeYear={activeYear!} />}
                {activeTab === 'classes' && <ClassesView classes={classes} selectedYearId={selectedYearId} />}
                {activeTab === 'students' && <StudentsView students={allStudents} classes={classes} selectedYearId={selectedYearId} activeYear={activeYear!} academicYears={academicYears} />}
                {activeTab === 'payment' && <PaymentView students={allStudents} activeYear={activeYear!} isAdmin={isAdmin} />}
                {activeTab === 'reports' && <ReportsView payments={payments} students={allStudents} activeYear={activeYear!} isSupervisor={isSupervisorAuthenticated && !isAdmin && !isCashierAuthenticated} />}
                {activeTab === 'settings' && <SettingsView settings={settings} activeYear={activeYear} academicYears={academicYears} selectedYearId={selectedYearId} students={students} setSelectedYearId={setSelectedYearId} isAdmin={isAdmin} />}
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function DashboardView({ students, payments, activeYear }: { students: Student[], payments: Payment[], activeYear: AcademicYear }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const todayPayments = payments.filter(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  });
  const todayRevenue = todayPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const payment = payments.find(p => p.id === deletingId);
      if (payment) {
        const student = students.find(s => s.id === payment.studentId);
        if (student) {
          let targetArrearsClass: 'class7' | 'class8' | 'class9' | null = null;
          
          if (payment.type === 'arrears' && payment.arrearsClass) {
            targetArrearsClass = payment.arrearsClass;
          } else {
            const currentClassPrefix = payment.studentClass ? payment.studentClass.charAt(0) : student.class.charAt(0);
            if (['7', '8', '9'].includes(currentClassPrefix)) {
               targetArrearsClass = `class${currentClassPrefix}` as 'class7' | 'class8' | 'class9';
            }
          }
          
          if (targetArrearsClass) {
            const currentArrears = student.arrears || { class7:{months:0,total:0}, class8:{months:0,total:0}, class9:{months:0,total:0} };
            const detail = (currentArrears as any)[targetArrearsClass];
            if (detail) {
               let newDetail;
               if (typeof detail === 'number') {
                 const total = detail + payment.totalAmount;
                 newDetail = { months: total / activeYear.defaultMonthlyAmount, monthlyRate: activeYear.defaultMonthlyAmount, total };
               } else {
                 const total = detail.total + payment.totalAmount;
                 newDetail = { ...detail, months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, total };
               }
               
               if (student.isAlumni) {
                 await updateDoc(doc(db, 'alumni', student.id), {
                   [`arrears.${targetArrearsClass}`]: newDetail
                 });
               } else {
                 await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', student.id), {
                   [`arrears.${targetArrearsClass}`]: newDetail
                 });
               }
            }
          }
        }
      }
      await deleteDoc(doc(db, 'academic_years', activeYear.id, 'payments', deletingId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic_years/${activeYear.id}/payments`);
    }
  };

  const currentAY = activeYear.label;
  const ayPayments = payments.filter(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    return getAcademicYear(d) === currentAY;
  });
  const ayRevenue = ayPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  const stats = [
    { label: 'Total Siswa', value: students.length, icon: Users, color: 'bg-blue-500' },
    { label: `Penerimaan TA ${currentAY}`, value: formatCurrency(ayRevenue), icon: CreditCard, color: 'bg-emerald-500' },
    { label: 'Penerimaan Hari Ini', value: formatCurrency(todayRevenue), icon: History, color: 'bg-amber-500' },
    { label: 'Transaksi Hari Ini', value: todayPayments.length, icon: CheckCircle2, color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, i) => (
        <div key={i} className="content-card p-6">
          <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">{stat.label}</p>
          <p className="text-2xl font-bold text-text-main">{stat.value}</p>
        </div>
      ))}
      
      <div className="col-span-full content-card p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-semibold text-text-main">Transaksi Terkini</h3>
          <span className="text-xs font-semibold text-accent cursor-pointer hover:underline">Lihat Semua</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="table-head">
                <th className="pb-4">Siswa</th>
                <th className="pb-4">Kelas</th>
                <th className="pb-4">Tanggal</th>
                <th className="pb-4">TA</th>
                <th className="pb-4 text-right">Jumlah</th>
                <th className="pb-4 text-center">Tipe</th>
                <th className="pb-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.slice(0, 5).map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="py-4 font-medium text-text-main">{p.studentName}</td>
                  <td className="py-4 text-text-muted">{p.studentClass}</td>
                  <td className="py-4 text-text-muted">
                    {format(p.date?.toDate ? p.date.toDate() : new Date(p.date), 'dd MMM yyyy')}
                  </td>
                  <td className="py-4 text-text-muted text-xs">
                    {getAcademicYear(p.date?.toDate ? p.date.toDate() : new Date(p.date))}
                  </td>
                  <td className="py-4 text-right font-bold text-text-main">{formatCurrency(p.totalAmount)}</td>
                  <td className="py-4 text-center">
                    <span className="badge badge-slate">
                      {p.type === 'full' ? 'Penuh' : 
                       p.type === 'arrears' ? 'Tunggakan' : 
                       p.type === 'noRekreasi' ? 'Tanpa Rekreasi' : 
                       p.type === 'onlyRekreasi' ? 'Hanya Rekreasi' : p.type}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => setDeletingId(p.id)}
                      className="btn-ghost p-2 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Hapus Transaksi?</h3>
            <p className="text-sm text-text-muted mb-6">Data pembayaran ini akan dihapus secara permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleDelete} className="btn btn-danger flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassesView({ classes, selectedYearId }: { classes: Class[], selectedYearId: string | null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const yearRef = doc(db, 'academic_years', selectedYearId!);
      await addDoc(collection(yearRef, 'classes'), {
        name: className.trim(),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setClassName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `academic_years/${selectedYearId}/classes`);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const yearRef = doc(db, 'academic_years', selectedYearId!);
      await deleteDoc(doc(yearRef, 'classes', deletingId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic_years/${selectedYearId}/classes`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Tambah Kelas
        </button>
      </div>

      <div className="content-card">
        <table className="data-table">
          <thead className="table-head">
            <tr>
              <th className="px-6 py-4">Nama Kelas</th>
              <th className="px-6 py-4">Dibuat Pada</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {classes.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="table-cell font-medium text-text-main">{c.name}</td>
                <td className="table-cell text-text-muted">
                  {c.createdAt?.toDate ? format(c.createdAt.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                </td>
                <td className="table-cell text-right">
                  <button 
                    onClick={() => setDeletingId(c.id)}
                    className="text-red-400 hover:text-red-600 transition-colors p-2"
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Hapus Kelas?</h3>
            <p className="text-sm text-text-muted mb-6">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleDelete} className="btn btn-danger flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="text-lg font-semibold mb-6">Tambah Kelas Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase mb-2">Nama Kelas</label>
                <input
                  required
                  type="text"
                  placeholder="misal: 7A, 8B"
                  className="input-field"
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Batal</button>
                <button type="submit" className="btn btn-primary flex-1">Simpan Kelas</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentsView({ students, classes, selectedYearId, activeYear, academicYears }: { students: Student[], classes: Class[], selectedYearId: string | null, activeYear: AcademicYear, academicYears: AcademicYear[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ total: number, current: number, success: number, failed: number } | null>(null);
  const [pendingMissingClasses, setPendingMissingClasses] = useState<{ parsedStudents: any[], conflicts: { nis: string, oldName: string, newName: string }[], failedParseCount: number, missingClasses: string[] } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ parsedStudents: any[], conflicts: { nis: string, oldName: string, newName: string }[], failedParseCount: number } | null>(null);
  const [skippedConflicts, setSkippedConflicts] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [studentTab, setStudentTab] = useState<'current' | 'alumni'>('current');
  const [alumniYearFilter, setAlumniYearFilter] = useState('');
  const [tariffAdjusters, setTariffAdjusters] = useState<Record<string, { month: number, newRate: number, isOpen: boolean }>>({});
  const [formData, setFormData] = useState({
    nis: '',
    name: '',
    class: '',
    status: 'regular' as StudentStatus,
    discountAmount: 0,
    arrears: {
      class7: { months: 0, monthlyRate: 150000, total: 0 },
      class8: { months: 0, monthlyRate: 150000, total: 0 },
      class9: { months: 0, monthlyRate: 150000, total: 0 }
    },
    arrearsMonths: 0,
    isActive: true,
    ikutRekreasi: true,
    isTransfer: false,
    transferDate: '',
    customMonthlyAmount: 0,
    previousClasses: {
      class7: '',
      class8: ''
    },
    isAlumni: false,
    graduatedYear: ''
  });

  useEffect(() => {
    if (editingStudent) {
      const normalizeArrears = (arr: any) => {
        if (typeof arr === 'number') {
          return { months: arr / 150000, monthlyRate: 150000, total: arr };
        }
        return arr || { months: 0, monthlyRate: 150000, total: 0 };
      };

      setFormData({
        nis: editingStudent.nis || editingStudent.id,
        name: editingStudent.name,
        class: editingStudent.class,
        status: editingStudent.status,
        discountAmount: editingStudent.discountAmount || 0,
        arrears: {
          class7: normalizeArrears(editingStudent.arrears?.class7),
          class8: normalizeArrears(editingStudent.arrears?.class8),
          class9: normalizeArrears(editingStudent.arrears?.class9)
        },
        arrearsMonths: editingStudent.arrearsMonths || 0,
        isActive: editingStudent.isActive !== undefined ? editingStudent.isActive : true,
        ikutRekreasi: editingStudent.ikutRekreasi !== undefined ? editingStudent.ikutRekreasi : true,
        isTransfer: editingStudent.isTransfer || false,
        transferDate: editingStudent.transferDate || '',
        customMonthlyAmount: editingStudent.customMonthlyAmount || 0,
        previousClasses: editingStudent.previousClasses || { class7: '', class8: '' },
        isAlumni: editingStudent.isAlumni || false,
        graduatedYear: editingStudent.graduatedYear || ''
      });
      setIsModalOpen(true);
    }
  }, [editingStudent]);

  const validateClassEntry = () => {
    const classNum = parseInt(formData.class);
    if (isNaN(classNum)) return true;

    if (classNum === 8 || classNum === 9) {
      if (!formData.isTransfer) {
        if (classNum === 8 && !formData.previousClasses.class7) {
          setAlertMsg("Siswa kelas 8 wajib mengisi data kelas 7 sebelumnya.");
          return false;
        }
        if (classNum === 9 && (!formData.previousClasses.class7 || !formData.previousClasses.class8)) {
          setAlertMsg("Siswa kelas 9 wajib mengisi data kelas 7 dan kelas 8 sebelumnya.");
          return false;
        }
      }
      
      if (formData.isTransfer && !formData.transferDate) {
        setAlertMsg("Tanggal pindah wajib diisi untuk siswa pindahan.");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.isAlumni && !validateClassEntry()) return;

    if (!editingStudent && students.some(s => s.nis === formData.nis)) {
      setAlertMsg("NIS sudah terdaftar. Silakan gunakan NIS lain.");
      return;
    }

    try {
      const yearRef = doc(db, 'academic_years', selectedYearId!);
      const studentData = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      if (editingStudent) {
        if (editingStudent.isAlumni) {
          await updateDoc(doc(db, 'alumni', editingStudent.id), studentData);
        } else {
          // Jika status diubah menjadi lulus atau ditandai alumni saat diedit
          if (formData.isAlumni || formData.status === 'lulus') {
            await setDoc(doc(db, 'alumni', editingStudent.id), { ...studentData, isAlumni: true, status: 'lulus' });
            await deleteDoc(doc(yearRef, 'students', editingStudent.id));
          } else {
            await updateDoc(doc(yearRef, 'students', editingStudent.id), studentData);
          }
        }
      } else {
        if (formData.isAlumni) {
          await setDoc(doc(db, 'alumni', formData.nis), {
            ...studentData,
            createdAt: serverTimestamp(),
            status: 'lulus'
          });
        } else {
          // Use NIS as document ID
          await setDoc(doc(yearRef, 'students', formData.nis), {
            ...studentData,
            createdAt: serverTimestamp()
          });
        }
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingStudent ? OperationType.UPDATE : OperationType.CREATE, `academic_years/${selectedYearId}/students`);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: selectedStudentIds.length });
    let success = 0;
    let failed = 0;
    try {
      const yearRef = doc(db, 'academic_years', selectedYearId!);
      for (const id of selectedStudentIds) {
        try {
          const student = students.find(s => s.id === id);
          
          // Hapus dari data tahun ajaran
          await deleteDoc(doc(yearRef, 'students', id));
          
          // Jika lulus atau alumni, hapus juga dari koleksi alumni
          if (student?.status === 'lulus' || student?.isAlumni) {
            await deleteDoc(doc(db, 'alumni', id));
          }
          
          success++;
        } catch (err) {
          failed++;
        }
        setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      setSelectedStudentIds([]);
      setAlertMsg(`Hapus masal selesai. Berhasil: ${success}, Gagal: ${failed}`);
    } catch (err) {
      setAlertMsg("Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteProgress({ current: 0, total: 0 });
      setDeletingId(null);
    }
  };

  const handleDelete = async () => {
    if (deletingId === 'BULK') {
      setDeletingId(null);
      await handleBulkDelete();
      return;
    }
    if (!deletingId) return;
    try {
      const student = students.find(s => s.id === deletingId);
      setDeletingId(null);


      // Selalu coba hapus dari kedua tempat jika ada kemungkinan duplikasi/status lulus
      const yearRef = doc(db, 'academic_years', selectedYearId!);
      await deleteDoc(doc(yearRef, 'students', deletingId));
      
      // Jika statusnya lulus atau isAlumni, pastikan hapus dari koleksi alumni juga
      if (student?.status === 'lulus' || student?.isAlumni) {
        await deleteDoc(doc(db, 'alumni', deletingId));
      }
      
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic_years/${selectedYearId}/students`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    const isAlumni = studentTab === 'alumni';
    const defaultMonthly = activeYear?.defaultMonthlyAmount || 150000;
    const defaultMonths = isAlumni ? 12 : 0;
    const defaultTotal = defaultMonths * defaultMonthly;

    setFormData({ 
      nis: '', name: '', class: '', status: 'regular', discountAmount: 0, 
      arrears: { 
        class7: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal }, 
        class8: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal }, 
        class9: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal } 
      }, 
      arrearsMonths: defaultMonths * 3, isActive: true, ikutRekreasi: true,
      isTransfer: false, transferDate: '', customMonthlyAmount: 0,
      previousClasses: { class7: '', class8: '' },
      isAlumni,
      graduatedYear: ''
    });
  };

  const downloadTemplate = () => {
    const headers = "nis;nama;status_siswa;tanggal_pindah;ikut_rekreasi;keluar;kelas7;perbulan7;kelas8;perbulan8;kls_now;bulanannow;bulankomite7;komite7;bulankomite8;komite8;bulankomitenow;komitenow;bulanrekreasi7;rekreasi7;bulanrekreasi8;rekreasi8;bulanrekreasinow;rekreasinow\n";
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'database_siswa.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const executeImport = async (parsedStudents: any[], initialFailedCount: number) => {
    let successCount = 0;
    let failedCount = initialFailedCount;
    const totalCount = parsedStudents.length + initialFailedCount;
    setImportProgress({ total: totalCount, current: initialFailedCount, success: 0, failed: failedCount });

    let currentCount = initialFailedCount;
    for (const data of parsedStudents) {
      currentCount++;
      try {
        await setDoc(doc(db, 'academic_years', selectedYearId!, 'students', data.nis), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        successCount++;
      } catch (err) {
        console.error("Error importing student:", data.nis, err);
        failedCount++;
      }
      setImportProgress(p => p ? { ...p, current: currentCount, success: successCount, failed: failedCount } : null);
    }
    
    setAlertMsg(`Import selesai: ${successCount} berhasil, ${failedCount} gagal.`);
    setImportProgress(null);
    setPendingImport(null);
    setIsImportModalOpen(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) return;

      const header = lines[0].toLowerCase();
      const isSemicolon = header.includes(';');
      const separator = isSemicolon ? ';' : ',';
      const dataLines = lines.slice(1).filter(l => l.trim() !== '');
      
      let failedParseCount = 0;
      const parsedStudents = [];
      const conflicts: { nis: string, oldName: string, newName: string }[] = [];
      const newClasses = new Set<string>();

      const prevYear = academicYears.slice().sort((a, b) => a.id.localeCompare(b.id)).reverse().find(y => y.id < selectedYearId!);
      let prevStudents: Student[] = [];
      if (prevYear) {
         try {
           const snap = await getDocs(collection(db, 'academic_years', prevYear.id, 'students'));
           prevStudents = snap.docs.map(d => ({id: d.id, ...d.data()}) as Student);
         } catch (e) {
           console.error("Failed to fetch prev year students", e);
         }
      }

      for (const line of dataLines) {
        const cols = line.split(separator).map(c => c.trim());
        
        if (cols.length < 9) {
           failedParseCount++;
           continue;
        }

        const nis = cols[0];
        const name = cols[1];
        const statusRaw = cols[2] ? cols[2].toLowerCase().trim() : '';
        const transferDateRaw = cols[3] ? cols[3].trim() : '';
        const ikutRekreasiStr = cols[4] ? cols[4].trim().toLowerCase() : 'true';
        const ikutRekreasi = ikutRekreasiStr === 'true' || ikutRekreasiStr === '1' || ikutRekreasiStr === 'y' || ikutRekreasiStr === 'ya' || ikutRekreasiStr === 'yes';
        const keluarStr = cols[5] ? cols[5].trim().toLowerCase() : 'false';
        const isKeluar = keluarStr === 'true' || keluarStr === '1' || keluarStr === 'y' || keluarStr === 'ya' || statusRaw.includes('keluar');
        const isActive = !isKeluar;

        const prevMatch = prevStudents.find(s => s.nis === nis && s.name.toLowerCase() === name.toLowerCase());

        const class7 = cols[6] || '';
        const perbulan7 = cols[7] ? Number(cols[7].replace(/\./g, '')) : activeYear.defaultMonthlyAmount;
        const class8 = cols[8] || '';
        const perbulan8 = cols[9] ? Number(cols[9].replace(/\./g, '')) : activeYear.defaultMonthlyAmount;
        
        let classNow = cols[10] || '';
        
        // JIKA SISWA KELUAR, MEREKA TIDAK BISA NAIK KELAS.
        // Kembalikan ke kelas sebelumnya (jika ada) dan jangan biarkan mereka menjadi anak kelas baru
        if (isKeluar && prevMatch && prevMatch.class) {
            classNow = prevMatch.class;
        }

        const bulananNow = cols[11] ? Number(cols[11].replace(/\./g, '')) : activeYear.defaultMonthlyAmount;

        const bulankomite7 = Number(cols[12]) || 0;
        // komite7 = cols[13]
        const bulankomite8 = Number(cols[14]) || 0;
        // komite8 = cols[15]
        const bulankomitenow = Number(cols[16]) || 0;
        // komitenow = cols[17]

        const bulanrekreasi7 = Number(cols[18]) || 0;
        // rekreasi7 = cols[19]
        const bulanrekreasi8 = Number(cols[20]) || 0;
        // rekreasi8 = cols[21]
        const bulanrekreasinow = Number(cols[22]) || 0;
        // rekreasinow = cols[23]

        const tabunganAmount = activeYear.allocations.filter(a => a.isTabungan).reduce((sum, a) => sum + a.amount, 0);
        const alokasiTabungan = ikutRekreasi ? tabunganAmount : 0;

        // Arrears calculations map exactly to specification
        const bKekuranganKomite7 = classNow.startsWith('8') || classNow.startsWith('9') ? Math.max(0, 12 - bulankomite7) : 0;
        const jKekuranganKomite7 = bKekuranganKomite7 * Math.max(0, perbulan7 - alokasiTabungan);
        
        const bKekuranganKomite8 = classNow.startsWith('9') ? Math.max(0, 12 - bulankomite8) : 0;
        const jKekuranganKomite8 = bKekuranganKomite8 * Math.max(0, perbulan8 - alokasiTabungan);
        
        const bKekuranganKomiteNow = classNow ? Math.max(0, 12 - bulankomitenow) : 0;
        const jKekuranganKomiteNow = bKekuranganKomiteNow * Math.max(0, bulananNow - alokasiTabungan);

        const bKekuranganRekreasi7 = (classNow.startsWith('8') || classNow.startsWith('9')) && ikutRekreasi ? Math.max(0, 12 - bulanrekreasi7) : 0;
        const jKekuranganRekreasi7 = bKekuranganRekreasi7 * alokasiTabungan;

        const bKekuranganRekreasi8 = classNow.startsWith('9') && ikutRekreasi ? Math.max(0, 12 - bulanrekreasi8) : 0;
        const jKekuranganRekreasi8 = bKekuranganRekreasi8 * alokasiTabungan;

        const bKekuranganRekreasiNow = classNow && ikutRekreasi ? Math.max(0, 12 - bulanrekreasinow) : 0;
        const jKekuranganRekreasiNow = bKekuranganRekreasiNow * alokasiTabungan;

        let bKekurangan7 = 0; let jKekurangan7 = 0; let monthly7 = perbulan7;
        let bKekurangan8 = 0; let jKekurangan8 = 0; let monthly8 = perbulan8;
        let bKekurangan9 = 0; let jKekurangan9 = 0; let monthly9 = bulananNow;

        if (classNow.startsWith('7')) {
            bKekurangan7 = Math.max(bKekuranganKomiteNow, bKekuranganRekreasiNow);
            jKekurangan7 = jKekuranganKomiteNow + jKekuranganRekreasiNow;
            monthly7 = bulananNow;
        } else if (classNow.startsWith('8')) {
            bKekurangan7 = Math.max(bKekuranganKomite7, bKekuranganRekreasi7);
            jKekurangan7 = jKekuranganKomite7 + jKekuranganRekreasi7;
            monthly7 = perbulan7;
            bKekurangan8 = Math.max(bKekuranganKomiteNow, bKekuranganRekreasiNow);
            jKekurangan8 = jKekuranganKomiteNow + jKekuranganRekreasiNow;
            monthly8 = bulananNow;
        } else if (classNow.startsWith('9')) {
            bKekurangan7 = Math.max(bKekuranganKomite7, bKekuranganRekreasi7);
            jKekurangan7 = jKekuranganKomite7 + jKekuranganRekreasi7;
            monthly7 = perbulan7;
            bKekurangan8 = Math.max(bKekuranganKomite8, bKekuranganRekreasi8);
            jKekurangan8 = jKekuranganKomite8 + jKekuranganRekreasi8;
            monthly8 = perbulan8;
            bKekurangan9 = Math.max(bKekuranganKomiteNow, bKekuranganRekreasiNow);
            jKekurangan9 = jKekuranganKomiteNow + jKekuranganRekreasiNow;
            monthly9 = bulananNow;
        }

        const hasYatim = statusRaw.includes('yatim');
        const hasKeringanan = statusRaw.includes('keringan');
        const hasPindahan = statusRaw.includes('pindah');
        const hasKeluar = isKeluar;
        const hasLulus = statusRaw.includes('lulus');

        let status: StudentStatus = 'regular';
        if (hasKeluar) status = 'keluar';
        else if (hasLulus) status = 'lulus';
        else if (hasYatim) status = 'yatim';
        else if (hasKeringanan) status = 'keringanan';
        else if (statusRaw === 'pindahan') {
           status = bulananNow === 30000 ? 'yatim' : (bulananNow < activeYear.defaultMonthlyAmount ? 'keringanan' : 'regular');
        }
        else {
           status = bulananNow === 30000 ? 'yatim' : (bulananNow < activeYear.defaultMonthlyAmount ? 'keringanan' : 'regular');
        }

        const isTransfer = hasPindahan || statusRaw === 'pindahan';
        const transferDate = transferDateRaw || '';

        const discountAmount = status === 'keringanan' ? Math.max(0, activeYear.defaultMonthlyAmount - bulananNow) : 0;

        const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
          nis,
          name,
          class: classNow,
          status,
          discountAmount,
          customMonthlyAmount: bulananNow,
          ikutRekreasi,
          arrears: {
            class7: { months: bKekurangan7, monthlyRate: monthly7, total: jKekurangan7 },
            class8: { months: bKekurangan8, monthlyRate: monthly8, total: jKekurangan8 },
            class9: { months: bKekurangan9, monthlyRate: monthly9, total: jKekurangan9 }
          },
          arrearsMonths: bKekurangan7 + bKekurangan8 + bKekurangan9,
          isActive,
          isTransfer,
          transferDate,
          previousClasses: {
            class7: class7 || '',
            class8: class8 || ''
          }
        };
        
        // Auto-calculate arrears for Transfer students if transferDate is provided
        if (isTransfer && transferDate) {
           const startDate = new Date(parseInt(activeYear.id.split('_')[0]), 6, 1);
           const tDate = new Date(transferDate);
           if (tDate >= startDate) {
               let monthsMissed = (tDate.getFullYear() - startDate.getFullYear()) * 12 + (tDate.getMonth() - startDate.getMonth());
               monthsMissed = Math.max(0, Math.min(11, monthsMissed));
               
               if (monthsMissed > 0) {
                   const tabRate = tabunganAmount;
                   const defaultRate = bulananNow > 0 ? bulananNow : activeYear.defaultMonthlyAmount;
                   const currentGradePrefix = classNow.charAt(0);
                   const currentClassGroup = currentGradePrefix === '7' ? 'class7' : currentGradePrefix === '8' ? 'class8' : 'class9';
                   
                   // Override current active year arrears based on transfer date pro-rata
                   const newTotal = (monthsMissed * tabRate) + ((12 - monthsMissed) * defaultRate);
                   (studentData.arrears as any)[currentClassGroup] = {
                       months: 12,
                       monthlyRate: defaultRate,
                       total: newTotal
                   };
                   
                   // Override previous years to only require Tabungan
                   if (currentGradePrefix === '8' || currentGradePrefix === '9') {
                       studentData.arrears.class7 = {
                           months: 12,
                           monthlyRate: tabRate,
                           total: 12 * tabRate
                       };
                   }
                   if (currentGradePrefix === '9') {
                       studentData.arrears.class8 = {
                           months: 12,
                           monthlyRate: tabRate,
                           total: 12 * tabRate
                       };
                   }
                   
                   // Recalculate total arrears months
                   studentData.arrearsMonths = 0; // The actual 'missed payment months' is handled differently in UI, but keep metadata consistent. In system, "arrearsMonths" tracks total unpaid. Wait, since its an override, we can set it via total.
                   // To keep it simple, leave arrearsMonths override to the frontend render.
               }
           }
        }

        if (prevMatch) {
            if (prevMatch.customMonthlyAmount) studentData.customMonthlyAmount = prevMatch.customMonthlyAmount;
            if (prevMatch.discountAmount) studentData.discountAmount = prevMatch.discountAmount;
            
            if (isKeluar) {
                studentData.status = 'keluar';
                studentData.isActive = false;
            } else if (prevMatch.status) {
                studentData.status = prevMatch.status;
            }
            
            if (prevMatch.isTransfer) studentData.isTransfer = prevMatch.isTransfer;
            
            const prevGrade = parseInt(prevMatch.class) || 0;
            studentData.previousClasses = {
                class7: prevGrade === 7 ? prevMatch.class : (studentData.previousClasses.class7 || prevMatch.previousClasses?.class7 || ''),
                class8: prevGrade === 8 ? prevMatch.class : (studentData.previousClasses.class8 || prevMatch.previousClasses?.class8 || '')
            };

            if (prevMatch.historicalAllocations) studentData.historicalAllocations = prevMatch.historicalAllocations;
            if (prevMatch.arrears) {
                studentData.arrears = prevMatch.arrears;
                studentData.arrearsMonths = prevMatch.arrearsMonths;
            }
        }

        const existing = students.find(s => s.nis === nis);
        if (existing) {
          conflicts.push({ nis, oldName: existing.name, newName: name });
        }
        
        parsedStudents.push(studentData);
        if (classNow) newClasses.add(classNow);
      }
      
      const missingClassesArr = Array.from(newClasses).filter(c => !classes.some(ex => ex.name === c));
      if (missingClassesArr.length > 0) {
        setPendingMissingClasses({ parsedStudents, conflicts, failedParseCount, missingClasses: missingClassesArr });
        return;
      }

      if (conflicts.length > 0) {
        setSkippedConflicts([]);
        setPendingImport({ parsedStudents, conflicts, failedParseCount });
      } else {
        executeImport(parsedStudents, failedParseCount);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filtered = students.filter(s => {
    if (studentTab === 'current' && s.isAlumni) return false;
    if (studentTab === 'alumni') {
      if (!s.isAlumni) return false;
      if (alumniYearFilter && s.graduatedYear !== alumniYearFilter) return false;
    }

    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.class.toLowerCase().includes(search.toLowerCase()) ||
      s.nis?.toLowerCase().includes(search.toLowerCase());
      
    const matchClass = classFilter ? s.class === classFilter : true;
    const matchStatus = statusFilter 
      ? statusFilter === 'aktif' ? s.isActive
      : statusFilter === 'tidak_aktif' ? !s.isActive
      : s.status === statusFilter 
      : true;

    return matchSearch && matchClass && matchStatus;
  });

  const totalActiveVII = students.filter(s => s.isActive && s.class.startsWith('7') && !s.isAlumni).length;
  const totalActiveVIII = students.filter(s => s.isActive && s.class.startsWith('8') && !s.isAlumni).length;
  const totalActiveIX = students.filter(s => s.isActive && s.class.startsWith('9') && !s.isAlumni).length;
  const totalActive = totalActiveVII + totalActiveVIII + totalActiveIX;

  const uniqueClasses = Array.from(new Set(students.filter(s => studentTab === 'current' ? !s.isAlumni : s.isAlumni).map(s => s.class))).filter(Boolean).sort();
  const alumniYears = Array.from(new Set(students.filter(s => s.isAlumni).map(s => s.graduatedYear).filter(Boolean))).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4 border-b border-border">
        <button
          onClick={() => setStudentTab('current')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${studentTab === 'current' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-main hover:border-slate-300'}`}
        >
          SISWA TAHUN AJARAN SEKARANG
        </button>
        <button
          onClick={() => setStudentTab('alumni')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${studentTab === 'alumni' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-main hover:border-slate-300'}`}
        >
          SISWA ALUMNI
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2 flex-1 max-w-2xl w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Cari NIS, nama atau kelas..."
              className="search-input w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {studentTab === 'alumni' && (
            <select 
              className="input-field w-40 content-center text-sm"
              value={alumniYearFilter}
              onChange={(e) => setAlumniYearFilter(e.target.value)}
            >
              <option value="">Semua Lulusan</option>
              {alumniYears.map(year => (
                <option key={year as string} value={year as string}>Lulusan {year as string}</option>
              ))}
            </select>
          )}
          {studentTab === 'current' && (
            <select 
              className="input-field w-32 content-center text-sm"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">Semua Kelas</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select 
            className="input-field w-32 content-center text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="tidak_aktif">Tidak Aktif</option>
            <option value="regular">Regular</option>
            <option value="yatim">Yatim</option>
            <option value="keringanan">Keringanan</option>
            {studentTab === 'current' && <option value="lulus">Lulus</option>}
            <option value="pindahan">Pindahan</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto mt-4 md:mt-0">
          <div className="flex gap-2 text-[10px] sm:text-xs mr-auto md:mr-2">
            {studentTab === 'current' ? (
              <>
                <span className="badge badge-blue">Kls 7: {totalActiveVII}</span>
                <span className="px-2 py-1 bg-green-50 text-green-700 font-medium rounded-md border border-green-100 uppercase text-[10px]">Kls 8: {totalActiveVIII}</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 font-medium rounded-md border border-purple-100 uppercase text-[10px]">Kls 9: {totalActiveIX}</span>
                <span className="badge badge-slate border border-slate-200">Total: {totalActive}</span>
              </>
            ) : (
              <span className="badge badge-slate border border-slate-200">Total: {filtered.length} Alumni</span>
            )}
          </div>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary px-4"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">Impor</span>
          </button>
          <button
            onClick={() => {
              const isAlumni = studentTab === 'alumni';
              const defaultMonthly = activeYear?.defaultMonthlyAmount || 150000;
              const defaultMonths = isAlumni ? 12 : 0;
              const defaultTotal = defaultMonths * defaultMonthly;

              setFormData(prev => ({ 
                ...prev, 
                isAlumni,
                arrears: {
                  class7: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal },
                  class8: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal },
                  class9: { months: defaultMonths, monthlyRate: defaultMonthly, total: defaultTotal }
                },
                arrearsMonths: defaultMonths * 3
              }));
              setIsModalOpen(true);
            }}
            className="btn btn-primary px-4"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Tambah Siswa</span>
          </button>
        </div>
      </div>

      <div className="content-card">
        {selectedStudentIds.length > 0 && (
          <div className="bg-blue-50 px-6 py-3 flex flex-col border-b border-border animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-800">{selectedStudentIds.length} siswa terpilih</span>
              <button
                onClick={() => setDeletingId('BULK')}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-md text-xs font-bold uppercase transition-colors"
              >
                <Trash2 size={14} />
                {isBulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
              </button>
            </div>
            
            {isBulkDeleting && bulkDeleteProgress.total > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                  <span>Progres Penghapusan</span>
                  <span>{Math.round((bulkDeleteProgress.current / bulkDeleteProgress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <table className="data-table">
          <thead className="table-head">
            <tr>
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox"
                  className="rounded border-border text-accent focus:ring-accent"
                  checked={filtered.length > 0 && selectedStudentIds.length === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedStudentIds(filtered.map(s => s.id));
                    else setSelectedStudentIds([]);
                  }}
                />
              </th>
              <th className="px-6 py-4">NIS & Nama</th>
              <th className="px-6 py-4">Kelas</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Total Tunggakan</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => {
              const arrearsTotals = activeYear?.id ? getTotalArrearsDisplay(s, activeYear.id) : { total: 0, months: 0 };
              return (
                <tr key={s.id} className={cn(
                  "table-row",
                  !s.isActive && "opacity-50 grayscale"
                )}>
                  <td className="table-cell">
                    <input 
                      type="checkbox" 
                      className="rounded border-border text-accent focus:ring-accent"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudentIds(prev => [...prev, s.id]);
                        else setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                      }}
                    />
                  </td>
                  <td className="table-cell">
                    <div className="text-[10px] font-bold text-accent uppercase tracking-wider">{s.nis}</div>
                    <div className="font-medium text-text-main text-sm">{s.name}</div>
                    {!s.isActive && <span className="badge badge-danger bg-red-100 text-red-600">Tidak Aktif</span>}
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-text-main uppercase">{s.class}</div>
                    {s.previousClasses && (s.previousClasses.class7 || s.previousClasses.class8) && (
                      <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                        <History size={10} />
                        {s.previousClasses.class7 && <span>{s.previousClasses.class7}</span>}
                        {s.previousClasses.class7 && s.previousClasses.class8 && <span>→</span>}
                        {s.previousClasses.class8 && <span>{s.previousClasses.class8}</span>}
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={cn(
                      "badge",
                      s.status === 'regular' ? "badge-blue" : "badge-slate"
                    )}>
                      {s.status === 'regular' ? 'Reguler' : 
                       s.status === 'yatim' ? 'Yatim' : 
                       s.status === 'keringanan' ? 'Keringanan' : 
                       s.status === 'lulus' ? 'Lulus' :
                       s.status === 'keluar' ? 'Keluar' : s.status}
                    </span>
                    {s.isAlumni && s.graduatedYear && (
                       <div className="text-[10px] text-text-muted mt-1 uppercase">
                         Lulusan: {s.graduatedYear}
                       </div>
                    )}
                  </td>
                  <td className="table-cell font-bold text-red-500">
                    {formatCurrency(arrearsTotals.total)}
                    <div className="text-[10px] text-text-muted uppercase tracking-tight font-normal">
                      {arrearsTotals.months.toFixed(1)} bulan
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setEditingStudent(s)}
                        className="btn-ghost p-2 rounded-lg"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(s.id)}
                        className="btn-ghost p-2 rounded-lg text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-semibold text-text-main tracking-tight">
                {editingStudent ? 'Ubah Data Siswa' : 'Daftar Siswa Baru'}
              </h3>
              <button onClick={closeModal} className="btn-ghost p-1 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">NIS</label>
                  <input
                    required
                    disabled={!!editingStudent}
                    type="text"
                    className="input-field disabled:opacity-50"
                    value={formData.nis}
                    onChange={e => setFormData({...formData, nis: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Nama Lengkap</label>
                  <input
                    required
                    type="text"
                    className="input-field"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Kelas</label>
                  {formData.isAlumni ? (
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="Contoh: 9A"
                      value={formData.class}
                      onChange={e => setFormData({...formData, class: e.target.value})}
                    />
                  ) : (
                    <select
                      required
                      className="input-field"
                      value={formData.class}
                      onChange={e => setFormData({...formData, class: e.target.value})}
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Status</label>
                  <select
                    className="input-field"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as StudentStatus})}
                  >
                    <option value="regular">Reguler</option>
                    <option value="yatim">Yatim</option>
                    <option value="keringanan">Keringanan</option>
                    <option value="keluar">Tidak Aktif / Keluar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="isTransfer"
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                    checked={formData.isTransfer}
                    onChange={e => setFormData({...formData, isTransfer: e.target.checked})}
                  />
                  <label htmlFor="isTransfer" className="text-xs font-semibold text-text-main uppercase tracking-tight">Pindahan</label>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-text-main uppercase tracking-tight">Aktif</label>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="ikutRekreasi"
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                    checked={formData.ikutRekreasi !== false} // Default to true
                    onChange={e => setFormData({...formData, ikutRekreasi: e.target.checked})}
                  />
                  <label htmlFor="ikutRekreasi" className="text-xs font-semibold text-text-main uppercase tracking-tight">Ikut Rekreasi</label>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="isAlumni"
                    className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
                    checked={formData.isAlumni}
                    onChange={e => setFormData({...formData, isAlumni: e.target.checked, status: e.target.checked ? 'lulus' : formData.status})}
                  />
                  <label htmlFor="isAlumni" className="text-xs font-semibold text-text-main uppercase tracking-tight">Siswa Alumni</label>
                </div>
              </div>

              {formData.isAlumni && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-2">Tahun Lulus</label>
                    <input
                      required={formData.isAlumni}
                      type="text"
                      placeholder="Contoh: 2023"
                      className="input-field border-amber-200 focus:border-amber-400 focus:ring-amber-400"
                      value={formData.graduatedYear}
                      onChange={e => setFormData({...formData, graduatedYear: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center">
                    <p className="text-xs text-amber-700 italic">
                      Jika status alumni dicentang, data ini tidak akan tampil sebagai siswa berjalan dan otomatis tersimpan di dalam data lulusan. Data tagihannya pun akan tetap tersimpan berdasarkan isian di bawah.
                    </p>
                  </div>
                </div>
              )}

              {formData.isTransfer && (
                <div className="flex flex-col gap-2 col-span-1 md:col-span-3">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Tanggal Pindah/Masuk</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      className="input-field flex-1 max-w-[200px]"
                      value={formData.transferDate}
                      onChange={e => setFormData({...formData, transferDate: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (!formData.transferDate) {
                            setAlertMsg("Silakan isikan Tanggal Pindah terlebih dahulu.");
                            return;
                        }
                        if (!formData.class) {
                            setAlertMsg("Silakan pilih Kelompok Kelas terlebih dahulu.");
                            return;
                        }
                        
                        const startDate = new Date(parseInt(activeYear.id.split('_')[0]), 6, 1);
                        const transferDate = new Date(formData.transferDate);
                        
                        if (transferDate < startDate) {
                            setAlertMsg("Tanggal pindah harus sesudah awal tahun ajaran (Juli).");
                            return;
                        }
                        
                        let monthsMissed = (transferDate.getFullYear() - startDate.getFullYear()) * 12 + (transferDate.getMonth() - startDate.getMonth());
                        monthsMissed = Math.max(0, Math.min(11, monthsMissed)); // cap at 11 missed months max
                        
                        if (monthsMissed <= 0) {
                            setAlertMsg("Bulan masuk sama dengan bulan awal (Juli), tidak ada diskon potongan bulan.");
                            return;
                        }
                        
                        const tabunganRate = activeYear.allocations.find(a => a.isTabungan)?.amount || 0;
                        const defaultRate = formData.customMonthlyAmount > 0 ? formData.customMonthlyAmount : (activeYear.defaultMonthlyAmount || 150000);
                        
                        // Menghitung total hutang: (bulan_terlewat * potongan_tabungan) + (sisa_bulan * full_rate)
                        const newTotal = (monthsMissed * tabunganRate) + ((12 - monthsMissed) * defaultRate);
                        
                        const gradePrefix = formData.class.charAt(0);
                        const currentClassGroup = gradePrefix === '7' ? 'class7' : gradePrefix === '8' ? 'class8' : 'class9';
                        
                        setFormData(prev => {
                            const newArrears = { ...prev.arrears } as any;
                            
                            // 1. Tagihan kelas/tahun yang sedang aktif (saat ia pindah masuk)
                            newArrears[currentClassGroup] = {
                                months: 12,
                                monthlyRate: defaultRate,
                                total: newTotal
                            };

                            // 2. Jika pindah di kelas 8 atau 9, maka kelas 7 hanya diset Tabungan saja 1 tahun penuh
                            if (gradePrefix === '8' || gradePrefix === '9') {
                                newArrears.class7 = {
                                    months: 12,
                                    monthlyRate: tabunganRate,
                                    total: 12 * tabunganRate
                                };
                            }
                            
                            // 3. Jika pindah di kelas 9, maka kelas 8 juga hanya diset Tabungan saja 1 tahun penuh
                            if (gradePrefix === '9') {
                                newArrears.class8 = {
                                    months: 12,
                                    monthlyRate: tabunganRate,
                                    total: 12 * tabunganRate
                                };
                            }

                            return { ...prev, arrears: newArrears };
                        });
                        
                        const prevMsg = (gradePrefix === '8' || gradePrefix === '9') ? ' Tagihan tunggakan riwayat kelas sebelumnya (kelas 7/8) juga telah di-reset untuk dikenakan kewajiban Rekreasi saja.' : '';
                        setAlertMsg(`Sukses! Selama ${monthsMissed} bulan pertama siswa hanya akan ditagih Rekreasi. Total Tunggakan setahun disesuaikan menjadi Rp ${newTotal.toLocaleString('id-ID')}.${prevMsg} (Cek Detail Tunggakan)`);
                      }}
                      className="btn btn-secondary text-xs whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                    >
                      Kalkulasi Otomatis Diskon Bulan
                    </button>
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">Gunakan tombol kalkulasi agar siswa hanya ditagih komponen Rekreasi pada bulan-bulan sebelum jadwal ia masuk (contoh: Pindah bulan Sept, maka tagihan Komite Juli-Agts di-Nol-kan).</p>
                </div>
              )}

              {(formData.class.startsWith('8') || formData.class.startsWith('9')) && (
                <div className="border-t border-border pt-6">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Riwayat Kelas Sebelumnya</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(formData.class.startsWith('8') || formData.class.startsWith('9')) && (
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Nama Kelas 7 (Sebelumnya)</label>
                        <select
                          className="input-field"
                          value={formData.previousClasses.class7}
                          onChange={e => setFormData({...formData, previousClasses: {...formData.previousClasses, class7: e.target.value}})}
                        >
                          <option value="">Pilih Kelas 7</option>
                          {classes.filter(c => c.name.startsWith('7')).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {formData.class.startsWith('9') && (
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Nama Kelas 8 (Sebelumnya)</label>
                        <select
                          className="input-field"
                          value={formData.previousClasses.class8}
                          onChange={e => setFormData({...formData, previousClasses: {...formData.previousClasses, class8: e.target.value}})}
                        >
                          <option value="">Pilih Kelas 8</option>
                          {classes.filter(c => c.name.startsWith('8')).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-6">
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Baseline Tagihan (Total 1 Tahun Ajaran Penuh)</label>
                  <p className="text-[10px] text-accent mt-1 bg-accent/10 py-1.5 px-3 rounded-lg border border-accent/20 leading-relaxed md:w-[70%]">
                    Nilai di bawah ini adalah <strong>Total Kewajiban Siswa untuk SETAHUN PENUH (12 Bulan)</strong>. Untuk Tagihan Bulan Berjalan (Juli s/d bulan ini), sistem akan <strong>memotong otomatis</strong> sisa bulannya secara real-time di tabel Dashboard & Pembayaran.<br/>Jadi, <strong>jangan ubah kolom 'Setahun(Bln)'</strong>, biarkan tetap bernilai 12.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['class7', 'class8', 'class9'].map((grade) => {
                    const detail = (formData.arrears as any)[grade];
                    return (
                      <div key={grade} className="space-y-3 p-4 bg-slate-50/30 border border-border rounded-xl">
                        <label className="block text-[10px] font-bold text-accent uppercase tracking-widest">{grade.replace('class', 'Kelas ')}</label>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1">Setahun(Bln)</label>
                            <input
                              type="number"
                              min="0"
                              max="12"
                              className="input-field py-2"
                              value={detail.months}
                              onChange={e => {
                                const months = Math.min(12, Math.max(0, Number(e.target.value)));
                                setFormData({
                                  ...formData,
                                  arrears: {
                                    ...formData.arrears,
                                    [grade]: { ...detail, months, total: months * detail.monthlyRate }
                                  }
                                });
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1">Biaya/Bln</label>
                            <input
                              type="number"
                              className="input-field py-2"
                              value={detail.monthlyRate}
                              onChange={e => {
                                const monthlyRate = Number(e.target.value);
                                setFormData({
                                  ...formData,
                                  arrears: {
                                    ...formData.arrears,
                                    [grade]: { ...detail, monthlyRate, total: detail.months * monthlyRate }
                                  }
                                });
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                          <label className="block text-[9px] font-bold text-text-muted uppercase mb-1">Total Baseline Setahun (Rp)</label>
                          <input
                            type="number"
                            className="input-field py-2 font-bold text-red-600"
                            value={detail.total}
                            onChange={e => {
                              const total = Number(e.target.value);
                              setFormData({
                                ...formData,
                                arrears: {
                                  ...formData.arrears,
                                  [grade]: { ...detail, total, months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0 }
                                }
                              });
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-1 pt-1 justify-between items-center mb-2">
                          <div className="flex flex-wrap gap-1">
                            {[1, 6, 12].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setFormData({
                                  ...formData,
                                  arrears: {
                                    ...formData.arrears,
                                    [grade]: { ...detail, months: m, total: m * detail.monthlyRate }
                                  }
                                })}
                                className="px-2 py-1 bg-white border border-border rounded text-[9px] font-bold hover:bg-slate-50 transition-colors"
                              >
                                SET {m} bln
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-text-muted italic">Ekuivalen: {detail.months.toFixed(1)} bln</span>
                        </div>
                        
                        <div className="pt-2 border-t border-border/50">
                          <button 
                             type="button" 
                             onClick={() => setTariffAdjusters({...tariffAdjusters, [grade]: { month: 1, newRate: detail.monthlyRate, isOpen: !tariffAdjusters[grade]?.isOpen }})}
                             className="text-[9px] font-bold text-accent uppercase w-full text-left flex justify-between items-center"
                          >
                            <span>+ Kalkulator Ganti Tarif (Mid-Tahun)</span>
                            <span>{tariffAdjusters[grade]?.isOpen ? '▼' : '►'}</span>
                          </button>
                          
                          {tariffAdjusters[grade]?.isOpen && (
                            <div className="mt-2 p-3 bg-white border border-border rounded-lg space-y-3">
                              <p className="text-[9px] text-text-muted leading-tight">Beritahu sistem kapan tarif baru berlaku agar Total Tunggakan dikalkulasi ulang otomatis.</p>
                              <div>
                                <label className="block text-[9px] font-bold text-text-muted uppercase mb-1">Berlaku Mulai</label>
                                <select 
                                  className="input-field py-1 text-xs" 
                                  value={tariffAdjusters[grade].month}
                                  onChange={e => setTariffAdjusters({...tariffAdjusters, [grade]: { ...tariffAdjusters[grade], month: Number(e.target.value) }})}
                                >
                                  {['Juli','Agustus','September','Oktober','November','Desember','Januari','Februari','Maret','April','Mei','Juni'].map((m, idx) => (
                                    <option key={idx} value={idx + 1}>{idx + 1}. {m}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-text-muted uppercase mb-1">Tarif Baru (Bln)</label>
                                <input 
                                  type="number" 
                                  className="input-field py-1 text-xs" 
                                  value={tariffAdjusters[grade].newRate}
                                  onChange={e => setTariffAdjusters({...tariffAdjusters, [grade]: { ...tariffAdjusters[grade], newRate: Number(e.target.value) }})}
                                />
                              </div>
                              <button
                                type="button"
                                className="w-full py-1.5 bg-accent text-white text-[10px] font-bold uppercase rounded"
                                onClick={() => {
                                   const adj = tariffAdjusters[grade];
                                   const oldTotal = detail.total;
                                   const oldRate = detail.monthlyRate;
                                   const monthsRemaining = 13 - adj.month;
                                   const newTotal = oldTotal + (monthsRemaining * (adj.newRate - oldRate));
                                   
                                   setFormData({
                                    ...formData,
                                    arrears: {
                                      ...formData.arrears,
                                      [grade]: { 
                                        ...detail, 
                                        monthlyRate: adj.newRate, 
                                        total: newTotal,
                                        months: adj.newRate > 0 ? newTotal / adj.newRate : 0
                                      }
                                    }
                                  });
                                  setTariffAdjusters({...tariffAdjusters, [grade]: { ...adj, isOpen: false }});
                                }}
                              >
                                Terapkan Perubahan
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-4 bg-accent/5 border border-accent/10 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-[11px] font-bold text-accent uppercase tracking-wider">Total Gabungan Tunggakan</label>
                      <p className="text-xl font-bold text-accent">
                        {formatCurrency(
                          (formData.arrears.class7.total || 0) + 
                          (formData.arrears.class8.total || 0) + 
                          (formData.arrears.class9.total || 0)
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Bulan</label>
                      <p className="text-lg font-bold text-text-main">
                        {(formData.arrears.class7.months || 0) + 
                         (formData.arrears.class8.months || 0) + 
                         (formData.arrears.class9.months || 0)} Bulan
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {formData.status === 'keringanan' && (
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Potongan Bulanan (Rp)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.discountAmount}
                    onChange={e => setFormData({...formData, discountAmount: Number(e.target.value)})}
                  />
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                >
                  {editingStudent ? 'Perbarui Data' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box p-10 translate-y-0 transition-transform">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-semibold text-text-main tracking-tight">Impor Siswa</h3>
              {!importProgress && <button onClick={() => setIsImportModalOpen(false)} className="btn-ghost p-1 rounded-full"><X size={20} /></button>}
            </div>
            
            <div className="space-y-6">
              {importProgress ? (
                <div className="p-6 border border-border rounded-xl text-center bg-slate-50/50">
                  <div className="mb-4">
                     <p className="text-sm font-semibold text-text-main mb-2">Memproses Data ({importProgress.current} / {importProgress.total})</p>
                     <div className="w-full bg-slate-200 rounded-full h-3">
                       <div className="bg-accent h-3 rounded-full transition-all duration-300" style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}></div>
                     </div>
                  </div>
                  <div className="flex justify-between text-xs font-medium px-2">
                     <span className="text-green-600">Berhasil: {importProgress.success}</span>
                     <span className="text-red-600">Gagal: {importProgress.failed}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-accent/40 transition-colors">
                    <FileText className="mx-auto text-text-muted mb-3" size={32} />
                    <p className="text-sm text-text-muted mb-2">Unggah file CSV sesuai template kami</p>
                    <p className="text-xs text-text-muted mb-4 font-mono px-4 text-left border-l-2 border-accent bg-slate-50 py-2">Info: Kolom <span className="font-bold">tanggal_pindah</span>, <span className="font-bold">ikut_rekreasi</span>, dan <span className="font-bold">keluar</span> diisi dengan status true/false atau 1/0</p>
                    <label className="inline-block px-6 py-2 bg-accent text-white rounded-lg font-bold text-[11px] uppercase tracking-widest cursor-pointer hover:bg-blue-700 shadow-md shadow-accent/10 transition-all">
                      Pilih File
                      <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                  
                  <button
                    onClick={downloadTemplate}
                    className="w-full btn btn-secondary"
                  >
                    <Download size={16} />
                    Unduh Template
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingMissingClasses && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-semibold">Ditemukan Kelas Baru</h3>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Terdapat <strong>{pendingMissingClasses.missingClasses.length} kelas</strong> di file CSV yang belum terdaftar di pengaturan:
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {pendingMissingClasses.missingClasses.map((cls, idx) => (
                <span key={idx} className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">
                  {cls}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-muted mb-6">
              Apakah Anda ingin menambahkannya secara otomatis dan melanjutkan import?
            </p>
            <div className="flex gap-3 mt-auto">
              <button 
                onClick={() => {
                  setPendingMissingClasses(null);
                  setIsImportModalOpen(false);
                }}
                className="btn btn-secondary flex-1"
              >
                Gagalkan
              </button>
              <button 
                onClick={async () => {
                  const toAdd = pendingMissingClasses.missingClasses;
                  const tempConflicts = pendingMissingClasses.conflicts;
                  const tempParsed = pendingMissingClasses.parsedStudents;
                  const tempFailed = pendingMissingClasses.failedParseCount;
                  setPendingMissingClasses(null);

                  try {
                    const batch = toAdd.map(c => addDoc(collection(db, 'academic_years', selectedYearId!, 'classes'), { name: c, createdAt: serverTimestamp() }));
                    await Promise.all(batch);
                  } catch (e) {
                    console.error("Gagal menambah kelas otomatis", e);
                  }

                  if (tempConflicts.length > 0) {
                    setSkippedConflicts([]);
                    setPendingImport({ parsedStudents: tempParsed, conflicts: tempConflicts, failedParseCount: tempFailed });
                  } else {
                    executeImport(tempParsed, tempFailed);
                  }
                }}
                className="btn btn-primary flex-1"
              >
                Tambahkan & Lanjut
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-semibold text-text-main mb-4">Konfirmasi Impor Data</h3>
            <p className="text-sm text-text-muted mb-4">
              Ditemukan <span className="font-bold text-accent">{pendingImport.conflicts.length}</span> data siswa yang sudah terdaftar berdasarkan NIS. Melanjutkan proses ini akan memperbarui dan <span className="font-bold text-red-500">menimpa</span> data siswa tersebut.
            </p>
            <div className="bg-slate-50 border border-border rounded-lg overflow-y-auto max-h-60 mb-6 text-sm">
              <table className="data-table">
                <thead className="table-head sticky top-0 bg-slate-100">
                  <tr>
                    <th className="p-3 font-semibold text-center w-10">Timpa</th>
                    <th className="p-3 font-semibold text-sm">NIS</th>
                    <th className="p-3 font-semibold w-full text-sm">Status Nama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingImport.conflicts.map(c => (
                    <tr key={c.nis} className="hover:bg-slate-100/50">
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox"
                          className="rounded border-border text-accent focus:ring-accent"
                          checked={!skippedConflicts.includes(c.nis)}
                          onChange={(e) => {
                            if (e.target.checked) setSkippedConflicts(prev => prev.filter(id => id !== c.nis));
                            else setSkippedConflicts(prev => [...prev, c.nis]);
                          }}
                        />
                      </td>
                      <td className="p-3 font-medium text-accent whitespace-nowrap">{c.nis}</td>
                      <td className="p-3">
                        {c.oldName === c.newName ? (
                          <div className="text-green-600 font-medium whitespace-nowrap flex items-center gap-1 text-xs">
                            Sesuai <span className="text-text-muted text-[10px] font-normal">({c.oldName})</span>
                          </div>
                        ) : (
                          <div className="text-amber-600 font-medium flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase font-bold">Berbeda</span>
                            <span className="text-[10px] text-text-muted line-through">{c.oldName}</span>
                            <span className="text-xs">{c.newName}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 mt-auto">
              <button 
                onClick={() => {
                  setPendingImport(null);
                  setIsImportModalOpen(false);
                }}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                   const finalStudents = pendingImport.parsedStudents.filter(s => !skippedConflicts.includes(s.nis));
                   const addedFailedCount = pendingImport.failedParseCount + skippedConflicts.length;
                   setPendingImport(null);
                   setIsImportModalOpen(false);
                   executeImport(finalStudents, addedFailedCount);
                }}
                className="btn btn-primary flex-1"
              >
                Lanjutkan Proses
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Hapus Siswa?</h3>
            <p className="text-sm text-text-muted mb-6">Data siswa ini akan dihapus secara permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleDelete} className="btn btn-danger flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm p-8">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-semibold">Perhatian</h3>
            </div>
            <p className="text-sm text-text-muted mb-6">{alertMsg}</p>
            <button onClick={() => setAlertMsg(null)} className="btn btn-primary w-full">Mengerti</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentView({ students, activeYear, isAdmin }: { students: Student[], activeYear: AcademicYear, isAdmin?: boolean }) {
  const [targetType, setTargetType] = useState<'active' | 'alumni'>('active');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState(0);
  const [paymentMonths, setPaymentMonths] = useState<number | ''>('');
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [arrearsClass, setArrearsClass] = useState<'class7' | 'class8' | 'class9'>('class7');
  const [isPrevious, setIsPrevious] = useState(false);
  const [search, setSearch] = useState('');
  const [transactionDate, setTransactionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ total: number, current: number, success: number, failed: number } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ parsedPayments: any[], failedCount: number } | null>(null);

  useEffect(() => {
    if (selectedStudent?.status === 'yatim') {
      if (paymentType === 'noRekreasi' || paymentType === 'onlyRekreasi') {
        setPaymentType('full');
      }
    }
  }, [selectedStudent, paymentType]);

  const targetStudents = targetType === 'active' 
    ? students.filter(s => !s.isAlumni)
    : students.filter(s => s.isAlumni);

  const classes = Array.from(new Set(targetStudents.map(s => s.class))).sort();
  const studentsInClass = targetStudents.filter(s => s.class === selectedClass);

  const getMonthlyAmount = (student: Student | null, type: PaymentType, argArrearsClass?: 'class7' | 'class8' | 'class9') => {
    if (!student) return activeYear.defaultMonthlyAmount;
    
    const currentArrearsClass = argArrearsClass || arrearsClass;

    if (type === 'arrears' && currentArrearsClass) {
      if (activeYear?.id) {
        // const displayData = getArrearsDisplay(student, currentArrearsClass, activeYear.id);
        const detail = (student.arrears as any)[currentArrearsClass];
        // If they want to pay arrears, suggest the real monthly rate if available, 
        // to keep "months" math sane. But base is monthlyRate.
        return detail?.monthlyRate || activeYear.defaultMonthlyAmount;
      }
      return activeYear.defaultMonthlyAmount;
    }

    if (student.status === 'yatim') {
      const tabungan = activeYear.allocations.find(a => a.isTabungan)?.amount || 0;
      return tabungan;
    }
    
    // If student has a custom monthly amount, use it as the base for 'full' payment
    let base = student.status === 'lulus' && student.historicalMonthlyAmount 
      ? student.historicalMonthlyAmount 
      : (student.customMonthlyAmount || activeYear.defaultMonthlyAmount);
    
    const allocationsToUse = student.status === 'lulus' && student.historicalAllocations 
      ? student.historicalAllocations 
      : activeYear.allocations;
    const tabungan = allocationsToUse.find(a => a.isTabungan)?.amount || 0;

    if (type === 'onlyRekreasi') return tabungan;
    if (type === 'noRekreasi') return base - tabungan;
               
    if (student.status === 'keringanan') {
      if (type === 'full') {
        base -= (student.discountAmount || 0);
      }
    }
    return base;
  };

  const calculateAllocations = (total: number, type: PaymentType, student: Student, argArrearsClass?: 'class7' | 'class8' | 'class9', overrideMonths?: number) => {
    let monthlyBase = getMonthlyAmount(student, type, argArrearsClass);
    let months = total / monthlyBase;

    if (overrideMonths && overrideMonths > 0) {
      months = overrideMonths;
      monthlyBase = total / months;
    }
    
    const allocationsToUse = student.status === 'lulus' && student.historicalAllocations 
      ? student.historicalAllocations 
      : activeYear.allocations;
      
    let monthlyAlloc: Record<string, number> = {};
    allocationsToUse.forEach(a => monthlyAlloc[a.id] = 0);

    const tabunganItem = allocationsToUse.find(a => a.isTabungan);

    if (student.status === 'yatim' || type === 'onlyRekreasi') {
      if (tabunganItem) {
        monthlyAlloc[tabunganItem.id] = monthlyBase;
      }
    } else {
      // Dynamic allocations based on settings
      let remaining = monthlyBase;
      
      // Sort by priority (higher priority first)
      const sortedAllocations = [...allocationsToUse].sort((a, b) => b.priority - a.priority);

      // Special handling for rekreasi/tabungan based on payment type
      const hasRekreasi = type !== 'noRekreasi' && type !== 'arrears';

      sortedAllocations.forEach(a => {
        if (a.isTabungan) {
          if (hasRekreasi) {
            monthlyAlloc[a.id] = Math.max(0, Math.min(a.amount, remaining));
            remaining -= monthlyAlloc[a.id];
          } else {
            monthlyAlloc[a.id] = 0;
          }
        } else if (a.id !== 'komite') { // Komite is usually the remainder
          monthlyAlloc[a.id] = Math.max(0, Math.min(a.amount, remaining));
          remaining -= monthlyAlloc[a.id];
        }
      });

      // Assign remainder to 'komite' or the lowest priority item if komite doesn't exist
      const komiteItem = allocationsToUse.find(a => a.id === 'komite');
      if (komiteItem) {
        monthlyAlloc['komite'] = Math.max(0, remaining);
      } else {
        const lowestPriority = sortedAllocations[sortedAllocations.length - 1];
        if (lowestPriority) {
          monthlyAlloc[lowestPriority.id] += Math.max(0, remaining);
        }
      }
    }
    
    const result: Record<string, number> = {};
    Object.keys(monthlyAlloc).forEach(key => {
      result[key] = monthlyAlloc[key] * months;
    });
    
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    let monthlyBase = getMonthlyAmount(selectedStudent, paymentType);
    let months = amount / monthlyBase;

    if (paymentMonths && paymentMonths > 0) {
      months = typeof paymentMonths === 'string' ? parseInt(paymentMonths) : paymentMonths;
      monthlyBase = amount / months;
    } else {
      if (paymentType === 'arrears' && amount % monthlyBase !== 0) {
        setAlertMsg(`Jumlah pembayaran tunggakan tidak valid. Harus kelipatan dari ${formatCurrency(monthlyBase)} (pembayaran harus bulat per bulan).`);
        return;
      }
      
      if (paymentType !== 'arrears' && amount % monthlyBase !== 0) {
        setAlertMsg(`Jumlah pembayaran tidak valid. Harus kelipatan dari ${formatCurrency(monthlyBase)} (pembayaran harus bulat per bulan).`);
        return;
      }
    }

    try {
      const yearRef = doc(db, 'academic_years', activeYear.id);
      await addDoc(collection(yearRef, 'payments'), {
        studentId: selectedStudent.id,
        studentNis: selectedStudent.nis,
        studentName: selectedStudent.name,
        studentClass: selectedStudent.class,
        academicYearId: activeYear.id,
        date: new Date(transactionDate),
        totalAmount: amount,
        monthsCovered: months,
        type: paymentType,
        arrearsClass: paymentType === 'arrears' ? arrearsClass : null,
        isPreviousBalance: isPrevious || paymentType === 'arrears',
        allocations: calculateAllocations(amount, paymentType, selectedStudent, paymentType === 'arrears' ? arrearsClass : undefined, months),
        createdAt: serverTimestamp()
      });

      if (paymentType === 'arrears') {
        const currentArrears = selectedStudent.arrears || { class7: {months:0,total:0}, class8: {months:0,total:0}, class9: {months:0,total:0} };
        const detail = (currentArrears as any)[arrearsClass];
        
        let newDetail;
        if (typeof detail === 'number') {
          const total = Math.max(0, detail - amount);
          newDetail = { months: total / monthlyBase, monthlyRate: monthlyBase, total };
        } else {
          const total = Math.max(0, detail.total - amount);
          newDetail = { ...detail, months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, total };
        }

        if (selectedStudent.isAlumni) {
          await updateDoc(doc(db, 'alumni', selectedStudent.id), {
            [`arrears.${arrearsClass}`]: newDetail
          });
        } else {
          await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', selectedStudent.id), {
            [`arrears.${arrearsClass}`]: newDetail
          });
        }
      } else {
        const currentClassPrefix = selectedStudent.class.charAt(0);
        if (['7', '8', '9'].includes(currentClassPrefix)) {
          const currentClassKey = `class${currentClassPrefix}` as 'class7'|'class8'|'class9';
          const currentArrears = selectedStudent.arrears || { class7: {months:0,total:0}, class8: {months:0,total:0}, class9: {months:0,total:0} };
          const detail = (currentArrears as any)[currentClassKey];
          
          if (detail && typeof detail === 'object') {
             // For regular payments, we strictly reduce the total debt out of 12 months for the current class.
             // If amount pays Tabungan only (onlyRekreasi), it reduces total debt perfectly without breaking komite logic.
             const total = Math.max(0, detail.total - amount); // floor to 0 if pre-paid (optional)
             const newDetail = { 
                ...detail, 
                months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, 
                total 
             };
             if (selectedStudent.isAlumni) {
               await updateDoc(doc(db, 'alumni', selectedStudent.id), {
                 [`arrears.${currentClassKey}`]: newDetail
               });
             } else {
               await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', selectedStudent.id), {
                 [`arrears.${currentClassKey}`]: newDetail
               });
             }
          }
        }
      }

      setAlertMsg("Pembayaran berhasil disimpan!");
      setSelectedStudent(null);
      setAmount(0);
      setSelectedClass('');
      setSearch('');
      setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentType('full');
      setPaymentMonths('');
      setArrearsClass('class7');
      setIsPrevious(false);
      setTargetType('active');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `academic_years/${activeYear.id}/payments`);
    }
  };

  const downloadPaymentTemplate = () => {
    const headers = "tanggal;nis;jumlah;bulan;tunggakan;rekreasi\n";
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'template_import_pembayaran.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const executeImportPayments = async (parsedPayments: any[], initialFailedCount: number) => {
    let successCount = 0;
    let failedCount = initialFailedCount;
    const totalCount = parsedPayments.length + initialFailedCount;
    setImportProgress({ total: totalCount, current: initialFailedCount, success: 0, failed: failedCount });

    let currentCount = initialFailedCount;
    const inMemoryArrears: Record<string, any> = {};

    for (const data of parsedPayments) {
      currentCount++;
      try {
        const yearRef = doc(db, 'academic_years', data.paymentData.academicYearId);
        await addDoc(collection(yearRef, 'payments'), {
          ...data.paymentData,
          createdAt: serverTimestamp()
        });
        
        // Update arrears if needed
        const student = data.student;
        const amount = data.paymentData.totalAmount;
        const paymentType = data.paymentData.type;
        const arrearsClassItem = data.paymentData.arrearsClass;
        const monthlyBase = data.monthlyBase;
        
        if (paymentType === 'arrears') {
          const currentArrears = inMemoryArrears[student.id] || student.arrears || { class7: {months:0,total:0}, class8: {months:0,total:0}, class9: {months:0,total:0} };
          const detail = (currentArrears as any)[arrearsClassItem];
          
          let newDetail;
          if (typeof detail === 'number') {
            const total = Math.max(0, detail - amount);
            newDetail = { months: total / monthlyBase, monthlyRate: monthlyBase, total };
          } else {
            const total = Math.max(0, detail.total - amount);
            newDetail = { ...detail, months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, total };
          }
  
          if (!inMemoryArrears[student.id]) inMemoryArrears[student.id] = { ...currentArrears };
          inMemoryArrears[student.id][arrearsClassItem] = newDetail;

          if (student.isAlumni) {
            await updateDoc(doc(db, 'alumni', student.id), {
              [`arrears.${arrearsClassItem}`]: newDetail
            });
          } else {
            await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', student.id), {
              [`arrears.${arrearsClassItem}`]: newDetail
            });
          }
        } else {
          const currentClassPrefix = student.class.charAt(0);
          if (['7', '8', '9'].includes(currentClassPrefix)) {
            const currentClassKey = `class${currentClassPrefix}` as 'class7'|'class8'|'class9';
            const currentArrears = inMemoryArrears[student.id] || student.arrears || { class7: {months:0,total:0}, class8: {months:0,total:0}, class9: {months:0,total:0} };
            const detail = (currentArrears as any)[currentClassKey];
            
            if (detail && typeof detail === 'object') {
               const total = Math.max(0, detail.total - amount); 
               const newDetail = { 
                  ...detail, 
                  months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, 
                  total 
               };
               
               if (!inMemoryArrears[student.id]) inMemoryArrears[student.id] = { ...currentArrears };
               inMemoryArrears[student.id][currentClassKey] = newDetail;

               if (student.isAlumni) {
                 await updateDoc(doc(db, 'alumni', student.id), {
                   [`arrears.${currentClassKey}`]: newDetail
                 });
               } else {
                 await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', student.id), {
                   [`arrears.${currentClassKey}`]: newDetail
                 });
               }
            }
          }
        }
        successCount++;
      } catch (err) {
        console.error("Error importing payment:", err);
        failedCount++;
      }
      setImportProgress(p => p ? { ...p, current: currentCount, success: successCount, failed: failedCount } : null);
    }
    
    setAlertMsg(`Import selesai: ${successCount} pembayaran berhasil, ${failedCount} gagal.`);
    setImportProgress(null);
    setPendingImport(null);
    setIsImportModalOpen(false);
  };

  const handleImportPayments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) return;

      const header = lines[0].toLowerCase();
      const isSemicolon = header.includes(';');
      const separator = isSemicolon ? ';' : ',';
      const dataLines = lines.slice(1).filter(l => l.trim() !== '');
      
      let failedParseCount = 0;
      const parsedPayments = [];

      for (const line of dataLines) {
        const cols = line.split(separator).map(c => c.trim());
        
        if (cols.length < 4) {
           failedParseCount++;
           continue;
        }

        const dateStr = cols[0];
        const nis = cols[1];
        const amountStr = cols[2];
        const monthsStr = cols[3];
        const tunggakanStr = cols[4] ? cols[4].toLowerCase().trim() : '';
        const rekreasiStr = cols[5] ? cols[5].toLowerCase().trim() : '';

        const student = students.find(s => s.nis === nis);
        if (!student) {
          failedParseCount++;
          continue;
        }

        let paymentType: PaymentType = 'full';
        let arrClass: 'class7' | 'class8' | 'class9' | null = null;
        let isPrev = false;

        if (tunggakanStr === '7' || tunggakanStr === '8' || tunggakanStr === '9') {
          paymentType = 'arrears';
          arrClass = `class${tunggakanStr}` as 'class7' | 'class8' | 'class9';
          isPrev = true;
        } else {
          if (rekreasiStr === 'tr') paymentType = 'noRekreasi';
          else if (rekreasiStr === 'rs') paymentType = 'onlyRekreasi';
        }

        const amount = Number(amountStr.replace(/\D/g, '')) || 0;
        const months = Number(monthsStr) || 0;
        
        // Validate date
        let parsedDate = new Date();
        if (dateStr) {
           // Assume YYYY-MM-DD or DD/MM/YYYY etc. We'll try just new Date()
           // For robust parsing, we might check if it's DD/MM
           const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
           if (parts.length === 3) {
             if (parts[0].length === 4) { // YYYY-MM-DD
               parsedDate = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
             } else { // DD-MM-YYYY
               parsedDate = new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0]));
             }
           } else {
             parsedDate = new Date(dateStr);
           }
        }
        
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date(); // fallback
        }

        const overrideMonths = months > 0 ? months : undefined;
        let monthlyBase = getMonthlyAmount(student, paymentType, arrClass || undefined);
        if (overrideMonths && amount > 0) {
          monthlyBase = amount / overrideMonths;
        }

        const allocations = calculateAllocations(amount, paymentType, student, arrClass || undefined, overrideMonths);

        parsedPayments.push({
          student,
          monthlyBase,
          paymentData: {
            studentId: student.id,
            studentNis: student.nis,
            studentName: student.name,
            studentClass: student.class,
            academicYearId: activeYear.id,
            date: parsedDate,
            totalAmount: amount,
            monthsCovered: months,
            type: paymentType,
            arrearsClass: arrClass,
            isPreviousBalance: isPrev || paymentType === 'arrears',
            allocations: allocations,
          }
        });
      }
      
      setPendingImport({ parsedPayments, failedCount: failedParseCount });
      // automatically execute
      executeImportPayments(parsedPayments, failedParseCount);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredStudents = targetStudents.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.class.toLowerCase().includes(search.toLowerCase()) ||
    s.nis?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-xl shadow-sm border border-border p-10">
        <div className="flex justify-between items-start mb-8">
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl w-fit">
            <button 
              type="button"
              onClick={() => {
                setTargetType('active');
                setSelectedStudent(null);
                setSelectedClass('');
              }}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all",
                targetType === 'active' ? "bg-white shadow-sm text-accent" : "text-text-muted hover:text-text-main"
              )}
            >
              Siswa Aktif
            </button>
            <button 
              type="button"
              onClick={() => {
                setTargetType('alumni');
                setSelectedStudent(null);
                setSelectedClass('');
              }}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all",
                targetType === 'alumni' ? "bg-white shadow-sm text-accent" : "text-text-muted hover:text-text-main"
              )}
            >
              Siswa Alumni
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn-secondary px-4 py-2 flex items-center gap-2"
            >
              <Upload size={16} />
              Impor
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Tanggal Transaksi</label>
              <input
                type="date"
                className="input-field py-3"
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Pilih Kelas</label>
              <select
                className="input-field py-3"
                value={selectedClass}
                onChange={e => {
                  setSelectedClass(e.target.value);
                  setSelectedStudent(null);
                }}
              >
                <option value="">Pilih Kelas</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Pilih Siswa</label>
              <select
                disabled={!selectedClass}
                className="input-field py-3 disabled:opacity-50"
                value={selectedStudent?.id || ''}
                onChange={e => {
                  const student = targetStudents.find(s => s.id === e.target.value);
                  setSelectedStudent(student || null);
                }}
              >
                <option value="">Pilih Siswa</option>
                {studentsInClass.map(s => <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>)}
              </select>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border"></div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">ATAU CARI BERDASARKAN NAMA/NIS</span>
              <div className="h-px flex-1 bg-border"></div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Ketik nama atau NIS..."
                className="input-field py-3 pl-12"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && !selectedStudent && (
              <div className="absolute z-10 w-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(s);
                      setSearch('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center text-sm"
                  >
                    <div>
                      <p className="font-medium text-text-main">{s.name}</p>
                      <p className="text-[11px] text-text-muted uppercase tracking-tight">{s.nis} • {s.class} • {s.status}</p>
                    </div>
                    <ChevronRight size={14} className="text-text-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
            <div className="bg-[#eff6ff] p-6 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-accent font-bold uppercase tracking-widest mb-1">Pilihan Aktif</p>
                  <p className="text-lg font-semibold text-text-main">{selectedStudent.name}</p>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{selectedStudent.nis} • Kelas {selectedStudent.class}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-accent hover:underline font-bold text-xs uppercase tracking-widest"
                >
                  Ganti
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-blue-100 pt-4">
                {['class7', 'class8', 'class9'].map(c => {
                  const displayData = activeYear?.id ? getArrearsDisplay(selectedStudent, c as any, activeYear.id) : { total: 0, months: 0 };
                  return (
                    <div key={c} className="bg-white/50 p-3 rounded-lg border border-blue-50">
                      <p className="text-[9px] font-bold text-text-muted uppercase mb-1">{c.replace('class', 'Tunggakan Kelas ')}</p>
                      <p className="text-sm font-bold text-red-500">{formatCurrency(displayData.total)}</p>
                      <p className="text-[9px] text-text-muted">{displayData.months.toFixed(1)} Bulan</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Tipe Pembayaran</label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'full', label: 'Bayar Penuh', amount: 150000 },
                  { id: 'noRekreasi', label: 'Tanpa Rekreasi', amount: 120000 },
                  { id: 'onlyRekreasi', label: 'Hanya Rekreasi', amount: 30000 },
                  { id: 'arrears', label: 'Bayar Tunggakan', amount: 0 },
                ].filter(type => {
                  if (selectedStudent?.status === 'yatim') {
                    return type.id === 'full' || type.id === 'arrears';
                  }
                  return true;
                }).map(type => {
                  const monthly = getMonthlyAmount(selectedStudent, type.id as PaymentType);
                  
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setPaymentType(type.id as PaymentType)}
                      className={cn(
                        "text-left p-4 rounded-lg border transition-all",
                        paymentType === type.id 
                          ? "border-accent bg-[#eff6ff] ring-1 ring-accent" 
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <p className="font-semibold text-text-main text-sm">{type.label}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {type.id === 'arrears' ? 'Jumlah kustom' : `${formatCurrency(monthly)} / bulan`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              {paymentType === 'arrears' && (
                <div className="animate-in fade-in slide-in-from-left-2">
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Tunggakan Untuk Kelas</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['class7', 'class8', 'class9'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setArrearsClass(c as any);
                          setAmount(0); // Reset amount when class changes to avoid confusion
                          setPaymentMonths('');
                        }}
                        className={cn(
                          "py-2 rounded-lg border text-[10px] font-bold uppercase transition-all",
                          arrearsClass === c ? "bg-accent text-white border-accent" : "bg-white text-text-muted border-border"
                        )}
                      >
                        {c.replace('class', 'Kelas ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Jumlah Bulan</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Otomatis"
                    className="input-field text-xl font-bold py-3"
                    value={paymentMonths || ''}
                    onChange={e => {
                      const m = parseInt(e.target.value);
                      if (!isNaN(m) && m > 0) {
                        setPaymentMonths(m);
                        if (selectedStudent) {
                          setAmount(getMonthlyAmount(selectedStudent, paymentType) * m);
                        }
                      } else {
                        setPaymentMonths('');
                      }
                    }}
                  />
                  {selectedStudent && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[1, 2, 3, 6, 12].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setPaymentMonths(m);
                            setAmount(getMonthlyAmount(selectedStudent, paymentType) * m);
                          }}
                          className="px-3 py-1.5 bg-white border border-border rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors"
                        >
                          {m} Bulan
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Jumlah Nominal (Rp)</label>
                  <input
                    required
                    type="number"
                    placeholder="0"
                    className="input-field text-2xl font-bold py-3"
                    value={amount || ''}
                    onChange={e => {
                      setAmount(Number(e.target.value));
                      setPaymentMonths('');
                    }}
                  />
                </div>
              </div>

              {amount > 0 && selectedStudent && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Perhitungan</p>
                  <p className="text-sm text-text-main">
                    Mencakup <span className="font-bold">{paymentMonths || (amount / getMonthlyAmount(selectedStudent, paymentType)).toFixed(1)} bulan</span> {paymentType === 'arrears' ? 'tunggakan' : 'pembayaran'}.
                    {paymentMonths && paymentMonths !== (amount / getMonthlyAmount(selectedStudent, paymentType)) && (
                      <span className="block mt-1 text-xs text-orange-600">
                        * Peringatan: Terdapat kustomisasi alokasi bulan ({formatCurrency(amount / Number(paymentMonths))} per bulan).
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedStudent || amount <= 0}
            className="w-full btn btn-primary py-4"
          >
            Proses Transaksi
          </button>
        </form>
      </div>

      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm p-8">
            <div className="flex items-center gap-3 text-accent mb-4">
              <CheckCircle2 size={24} />
              <h3 className="text-lg font-semibold">Tersimpan</h3>
            </div>
            <p className="text-sm text-text-muted mb-6">{alertMsg}</p>
            <button onClick={() => setAlertMsg(null)} className="btn btn-primary w-full">Mengerti</button>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box p-10 translate-y-0 transition-transform">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-semibold text-text-main tracking-tight">Impor Transaksi Pembayaran</h3>
              {!importProgress && <button onClick={() => setIsImportModalOpen(false)} className="btn-ghost p-1 rounded-full"><X size={20} /></button>}
            </div>
            
            <div className="space-y-6">
              {importProgress ? (
                <div className="p-6 border border-border rounded-xl text-center bg-slate-50/50">
                  <div className="mb-4">
                     <p className="text-sm font-semibold text-text-main mb-2">Memproses Data ({importProgress.current} / {importProgress.total})</p>
                     <div className="w-full bg-slate-200 rounded-full h-3">
                       <div className="bg-accent h-3 rounded-full transition-all duration-300" style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}></div>
                     </div>
                  </div>
                  <div className="flex justify-between text-xs font-medium px-2">
                     <span className="text-green-600">Berhasil: {importProgress.success}</span>
                     <span className="text-red-600">Gagal: {importProgress.failed}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-accent/40 transition-colors">
                    <FileText className="mx-auto text-text-muted mb-3" size={32} />
                    <p className="text-sm text-text-muted mb-2">Unggah file CSV sesuai template kami</p>
                    <p className="text-xs text-text-muted mb-4 font-mono px-4 text-left border-l-2 border-accent bg-slate-50 py-2">Info: Kolom <span className="font-bold">tunggakan</span> (\"7\", \"8\", \"9\") dan <span className="font-bold">rekreasi</span> (\"tr\" untuk tanpa rekreasi, \"rs\" untuk hanya rekreasi)</p>
                    <label className="inline-block px-6 py-2 bg-accent text-white rounded-lg font-bold text-[11px] uppercase tracking-widest cursor-pointer hover:bg-blue-700 shadow-md shadow-accent/10 transition-all">
                      Pilih File
                      <input type="file" accept=".csv" className="hidden" onChange={handleImportPayments} />
                    </label>
                  </div>
                  
                  <button
                    onClick={downloadPaymentTemplate}
                    className="w-full btn btn-secondary"
                  >
                    <Download size={18} />
                    Unduh Format CSV
                  </button>
                  
                  {pendingImport && pendingImport.parsedPayments.length === 0 && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-center justify-between">
                      <p>Tidak ada baris valid ditemukan, gagal impor: {pendingImport.failedCount}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsView({ payments, students, activeYear, isSupervisor }: { payments: Payment[], students: Student[], activeYear: AcademicYear, isSupervisor?: boolean }) {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'academic' | 'class' | 'student' | 'discount'>('daily');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(activeYear.label);
  const [selectedMonthlyCategory, setSelectedMonthlyCategory] = useState('all');
  const [selectedEndDate, setSelectedEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDailyDate, setSelectedDailyDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [studentSearch, setStudentSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAcademicYear(activeYear.label);
  }, [activeYear.id]);

  const classes = Array.from(new Set(students.map(s => s.class))).sort();
  const academicYears = Array.from(new Set([activeYear.label, ...payments.map(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    return getAcademicYear(d);
  })])).sort().reverse();

  const filteredPayments = payments.filter(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    if (reportType === 'daily') return format(d, 'yyyy-MM-dd') === selectedDailyDate;
    if (reportType === 'monthly') {
       const endDate = new Date(selectedEndDate);
       endDate.setHours(23, 59, 59, 999);
       if (d > endDate) return false;

       if (selectedMonthlyCategory === '7') return p.studentClass.startsWith('7') && p.type !== 'arrears';
       if (selectedMonthlyCategory === '8') return p.studentClass.startsWith('8') && p.type !== 'arrears';
       if (selectedMonthlyCategory === '9') return p.studentClass.startsWith('9') && p.type !== 'arrears';
       if (selectedMonthlyCategory === 'all') return p.type !== 'arrears';
       if (selectedMonthlyCategory === 'tanggungan') return p.type === 'arrears';
       return true;
    }
    if (reportType === 'academic') {
      const matchYear = getAcademicYear(d) === selectedAcademicYear;
      if (!matchYear) return false;
      if (selectedClass) return p.studentClass === selectedClass;
      return true;
    }
    if (reportType === 'class') return p.studentClass === selectedClass;
    if (reportType === 'student') {
      if (selectedStudentId) return p.studentId === selectedStudentId;
      if (!selectedClass && !studentSearch) return false;
      if (selectedClass && p.studentClass !== selectedClass) return false;
      if (studentSearch && !(p.studentName.toLowerCase().includes(studentSearch.toLowerCase()) || p.studentNis?.toLowerCase().includes(studentSearch.toLowerCase()))) return false;
      return true;
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const payment = payments.find(p => p.id === deletingId);
      if (payment) {
        const student = students.find(s => s.id === payment.studentId);
        if (student) {
          let targetArrearsClass: 'class7' | 'class8' | 'class9' | null = null;
          
          if (payment.type === 'arrears' && payment.arrearsClass) {
            targetArrearsClass = payment.arrearsClass;
          } else {
            const currentClassPrefix = payment.studentClass ? payment.studentClass.charAt(0) : student.class.charAt(0);
            if (['7', '8', '9'].includes(currentClassPrefix)) {
               targetArrearsClass = `class${currentClassPrefix}` as 'class7' | 'class8' | 'class9';
            }
          }
          
          if (targetArrearsClass) {
            const currentArrears = student.arrears || { class7:{months:0,total:0}, class8:{months:0,total:0}, class9:{months:0,total:0} };
            const detail = (currentArrears as any)[targetArrearsClass];
            if (detail) {
               let newDetail;
               if (typeof detail === 'number') {
                 const total = detail + payment.totalAmount;
                 newDetail = { months: total / activeYear.defaultMonthlyAmount, monthlyRate: activeYear.defaultMonthlyAmount, total };
               } else {
                 const total = detail.total + payment.totalAmount;
                 newDetail = { ...detail, months: detail.monthlyRate > 0 ? total / detail.monthlyRate : 0, total };
               }
               
               if (student.isAlumni) {
                 await updateDoc(doc(db, 'alumni', student.id), {
                   [`arrears.${targetArrearsClass}`]: newDetail
                 });
               } else {
                 await updateDoc(doc(db, 'academic_years', activeYear.id, 'students', student.id), {
                   [`arrears.${targetArrearsClass}`]: newDetail
                 });
               }
            }
          }
        }
      }
      await deleteDoc(doc(db, 'academic_years', activeYear.id, 'payments', deletingId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic_years/${activeYear.id}/payments`);
    }
  };

  const total = filteredPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        {[
          { id: 'daily', label: 'Harian' },
          { id: 'monthly', label: 'Rekap Bulanan' },
          { id: 'academic', label: 'Tahun Ajaran' },
          { id: 'class', label: 'Per Kelas' },
          { id: 'student', label: 'Per Siswa' },
          { id: 'discount', label: 'Data Keringanan & Yatim' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id as any)}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              reportType === t.id 
                ? "bg-accent text-white shadow-lg shadow-accent/20" 
                : "bg-card text-text-muted border border-border hover:border-slate-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-base font-semibold text-text-main">
              {reportType === 'daily' ? 'Ringkasan Harian' : 
               reportType === 'monthly' ? 'Laporan Rekapitulasi Tahunan (Per Bulan)' : 
               reportType === 'academic' ? `Laporan Tahun Ajaran ${selectedAcademicYear.replace('_', '/')}` :
               reportType === 'class' ? `Laporan Kelas ${selectedClass}` : 'Riwayat Siswa'}
            </h3>
            {reportType !== 'monthly' && (
              <p className="text-[11px] text-text-muted uppercase tracking-wider mt-1 font-bold">
                Total Pendapatan: <span className="text-accent">{formatCurrency(total)}</span>
              </p>
            )}
          </div>

          <div className="flex gap-3">
            {reportType === 'daily' && (
              <input 
                type="date"
                className="input-field py-2"
                value={selectedDailyDate}
                onChange={e => setSelectedDailyDate(e.target.value)}
              />
            )}
            {reportType === 'monthly' && (
              <>
                <input 
                  type="date"
                  className="input-field py-2"
                  value={selectedEndDate}
                  onChange={e => setSelectedEndDate(e.target.value)}
                />
                <select 
                  className="input-field py-2"
                  value={selectedMonthlyCategory}
                  onChange={e => setSelectedMonthlyCategory(e.target.value)}
                >
                  <option value="all">Kelas VII, VIII, IX</option>
                  <option value="7">Kelas VII</option>
                  <option value="8">Kelas VIII</option>
                  <option value="9">Kelas IX</option>
                  <option value="tanggungan">Tanggungan Sumbangan Komite</option>
                </select>
              </>
            )}
            {reportType === 'academic' && (
              <>
                <select 
                  className="input-field py-2"
                  value={selectedAcademicYear}
                  onChange={e => setSelectedAcademicYear(e.target.value)}
                >
                  {academicYears.map(ay => <option key={ay} value={ay}>{ay.replace('_', '/')}</option>)}
                </select>
                <select 
                  className="input-field py-2"
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {reportType === 'class' && (
              <select 
                className="input-field py-2"
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
              >
                <option value="">Pilih Kelas</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {reportType === 'student' && (
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <select 
                  className="input-field py-2 text-sm"
                  value={selectedClass}
                  onChange={e => {
                    setSelectedClass(e.target.value);
                    setSelectedStudentId('');
                  }}
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Nama/NIS..."
                    className="input-field py-2 pl-9 text-sm w-36"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                </div>
                <select 
                  className="input-field py-2 max-w-xs text-sm"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Pilih Siswa</option>
                  {students
                    .filter(s => selectedClass ? s.class === selectedClass : true)
                    .filter(s => studentSearch ? (s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.nis?.includes(studentSearch)) : true)
                    .map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {reportType === 'monthly' ? (
          <AcademicMonthlyReport 
            payments={payments}
            activeYear={activeYear}
            category={selectedMonthlyCategory}
            endDate={selectedEndDate}
          />
        ) : reportType === 'academic' ? (
          <AcademicSummaryReport filteredPayments={filteredPayments} />
        ) : reportType === 'class' && selectedClass ? (
          <ClassArrearsReport 
            students={students} 
            selectedClass={selectedClass} 
            activeYear={activeYear} 
          />
        ) : reportType === 'daily' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[11px] text-text-muted uppercase tracking-wider font-bold border-b border-border">
                <tr>
                  <th className="pb-4 border-r border-border pr-4 px-2 w-10 text-center">No</th>
                  <th className="pb-4 border-r border-border px-4">Tanggal</th>
                  <th className="pb-4 border-r border-border px-4">Nama</th>
                  <th className="pb-4 border-r border-border px-4">Kelas</th>
                  <th className="pb-4 border-r border-border px-4 text-right">Jumlah Bayar</th>
                  {!isSupervisor && <th className="pb-4 text-right px-2">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((p, idx) => (
                  <tr key={p.id} className="text-[13px] hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-text-muted border-r border-border pr-4 px-2 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-4 text-text-muted border-r border-border px-4">
                      {format(p.date?.toDate ? p.date.toDate() : new Date(p.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-4 font-medium text-text-main border-r border-border px-4">{p.studentName}</td>
                    <td className="py-4 text-text-muted border-r border-border px-4">{p.studentClass}</td>
                    <td className="py-4 text-right font-bold text-text-main border-r border-border px-4">{formatCurrency(p.totalAmount)}</td>
                    {!isSupervisor && (
                      <td className="py-4 text-right px-2">
                        <button 
                          onClick={() => setDeletingId(p.id)}
                          className="text-text-muted hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-text-muted">
                      <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-xs font-bold uppercase tracking-widest">Data tidak ditemukan</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : reportType === 'student' && selectedStudentId ? (
          (() => {
             const student = students.find(s => s.id === selectedStudentId);
             if (!student) return <div className="text-center py-8 text-text-muted">Siswa tidak ditemukan</div>;
             return (
               <div className="space-y-8 animate-in fade-in">
                  <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 border border-border rounded-xl md:items-start">
                     <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold text-text-main">{student.name}</h4>
                          <span className={cn(
                            "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                            student.status === 'yatim' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                            student.status === 'keringanan' ? "bg-blue-100 text-blue-700 border border-blue-200" :
                            student.status === 'lulus' ? "bg-slate-200 text-slate-700 border border-slate-300" :
                            student.status === 'keluar' ? "bg-red-100 text-red-700 border border-red-200" :
                            "bg-slate-200 text-slate-700"
                          )}>
                            {student.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-text-muted font-medium mb-4">
                          {student.nis} &bull; Kelas {student.class}
                          {student.isAlumni && student.graduatedYear && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">
                              Lulusan: {student.graduatedYear}
                            </span>
                          )}
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-4 mt-2">
                           {['class7', 'class8', 'class9'].map(c => {
                             const arrears = getArrearsDisplay(student, c as 'class7'|'class8'|'class9', activeYear.id);
                             return (
                               <div key={c} className="bg-white p-3 rounded-lg border border-border shadow-sm">
                                 <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{c.replace('class', 'Tunggakan Kls ')}</p>
                                 <p className="text-sm font-bold text-red-600">{formatCurrency(arrears.total)}</p>
                                 <p className="text-[10px] text-text-muted">{arrears.months.toFixed(1)} bln aktif bln ini</p>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                  </div>

                  <div>
                     <h4 className="text-base font-bold text-text-main mb-4">Riwayat Pembayaran {student.name}</h4>
                     <div className="overflow-x-auto">
                       <table className="w-full text-left bg-white border border-border rounded-xl">
                        <thead className="text-[11px] text-text-muted uppercase tracking-wider font-bold border-b border-border bg-slate-50">
                          <tr>
                            <th className="py-4 pl-4 pr-2 w-10 text-center">No</th>
                            <th className="py-4 px-4">Tanggal</th>
                            <th className="py-4 px-4">TA Transaksi</th>
                            <th className="py-4 px-4 text-right">Jumlah Bayar</th>
                            {!isSupervisor && <th className="py-4 text-right pr-4 pl-2">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredPayments.map((p, idx) => (
                            <tr key={p.id} className="text-[13px] hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-2 text-center text-text-muted">{idx + 1}</td>
                              <td className="py-4 px-4 text-text-muted">
                                {format(p.date?.toDate ? p.date.toDate() : new Date(p.date), 'dd/MM/yyyy HH:mm')}
                              </td>
                              <td className="py-4 px-4 text-text-muted text-[11px]">
                                Tahun {getAcademicYear(p.date?.toDate ? p.date.toDate() : new Date(p.date))}
                              </td>
                              <td className="py-4 px-4 text-right font-bold text-text-main">{formatCurrency(p.totalAmount)}</td>
                              {!isSupervisor && (
                                <td className="py-4 pr-4 pl-2 text-right">
                                  <button 
                                    onClick={() => setDeletingId(p.id)}
                                    className="text-text-muted hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {filteredPayments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-16 text-center text-text-muted">
                                <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
                                <p className="text-xs font-bold uppercase tracking-widest">Belum ada riwayat pembayaran</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                     </div>
                  </div>
               </div>
             );
          })()
        ) : reportType === 'discount' ? (
          (() => {
            const specialStudents = students.filter(s => s.isActive && (s.status === 'yatim' || s.status === 'keringanan'));
            return (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                   <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl flex-1 shadow-sm">
                     <h4 className="text-amber-700 font-bold text-xs uppercase tracking-widest mb-1">Status Yatim</h4>
                     <p className="text-3xl font-bold text-amber-800">{specialStudents.filter(s => s.status === 'yatim').length} <span className="text-sm font-medium">Siswa Aktif</span></p>
                   </div>
                   <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl flex-1 shadow-sm">
                     <h4 className="text-blue-700 font-bold text-xs uppercase tracking-widest mb-1">Status Keringanan</h4>
                     <p className="text-3xl font-bold text-blue-800">{specialStudents.filter(s => s.status === 'keringanan').length} <span className="text-sm font-medium">Siswa Aktif</span></p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left bg-white border border-border rounded-xl">
                     <thead className="text-[11px] text-text-muted uppercase tracking-wider font-bold border-b border-border bg-slate-50">
                        <tr>
                          <th className="py-4 pl-4 pr-2 w-10 text-center">No</th>
                          <th className="py-4 px-4">NIS</th>
                          <th className="py-4 px-4">Nama</th>
                          <th className="py-4 px-4">Kelas</th>
                          <th className="py-4 px-4">Status</th>
                          <th className="py-4 px-4 text-right">Tarif Aktif Saat Ini</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                        {specialStudents.sort((a,b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name)).map((s, idx) => {
                           let activeTariff = 0;
                           if (s.class.startsWith('7')) activeTariff = typeof s.arrears?.class7 === 'number' ? activeYear.defaultMonthlyAmount : (s.arrears?.class7?.monthlyRate || 0);
                           if (s.class.startsWith('8')) activeTariff = typeof s.arrears?.class8 === 'number' ? activeYear.defaultMonthlyAmount : (s.arrears?.class8?.monthlyRate || 0);
                           if (s.class.startsWith('9')) activeTariff = typeof s.arrears?.class9 === 'number' ? activeYear.defaultMonthlyAmount : (s.arrears?.class9?.monthlyRate || 0);
                           
                           return (
                             <tr key={s.id} className="text-[13px] hover:bg-slate-50/50 transition-colors">
                               <td className="py-4 px-2 text-center text-text-muted">{idx + 1}</td>
                               <td className="py-4 px-4 text-text-muted">{s.nis}</td>
                               <td className="py-4 px-4 font-medium text-text-main">{s.name}</td>
                               <td className="py-4 px-4 text-text-muted">{s.class}</td>
                               <td className="py-4 px-4">
                                 <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                                    s.status === 'yatim' ? "bg-amber-100 text-amber-700 bg-opacity-50" : "bg-blue-100 text-blue-700 bg-opacity-50"
                                 )}>
                                   {s.status}
                                 </span>
                               </td>
                               <td className="py-4 px-4 text-right font-bold text-accent">{formatCurrency(activeTariff)}/bln</td>
                             </tr>
                           )
                        })}
                        {specialStudents.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-text-muted">
                              <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
                              <p className="text-xs font-bold uppercase tracking-widest">Tidak ada siswa berstatus khusus</p>
                            </td>
                          </tr>
                        )}
                     </tbody>
                   </table>
                </div>
              </div>
            )
          })()
        ) : (
          <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead className="text-[11px] text-text-muted uppercase tracking-wider font-bold border-b border-border">
                <tr>
                  <th className="pb-4 border-r border-border pr-4 px-2 w-10 text-center">No</th>
                  <th className="pb-4 border-r border-border px-4">Tanggal</th>
                  <th className="pb-4 border-r border-border px-4">Nama</th>
                  <th className="pb-4 border-r border-border px-4">Kelas</th>
                  <th className="pb-4 border-r border-border px-4 text-right">Jumlah Bayar</th>
                  {!isSupervisor && <th className="pb-4 text-right px-2">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((p, idx) => (
                  <tr key={p.id} className="text-[13px] hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-text-muted border-r border-border pr-4 px-2 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-4 text-text-muted border-r border-border px-4">
                      {format(p.date?.toDate ? p.date.toDate() : new Date(p.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-4 font-medium text-text-main border-r border-border px-4">{p.studentName}</td>
                    <td className="py-4 text-text-muted border-r border-border px-4">{p.studentClass}</td>
                    <td className="py-4 text-right font-bold text-text-main border-r border-border px-4">{formatCurrency(p.totalAmount)}</td>
                    {!isSupervisor && (
                      <td className="py-4 text-right px-2">
                        <button 
                          onClick={() => setDeletingId(p.id)}
                          className="text-text-muted hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-text-muted">
                      <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
                      <p className="text-xs font-bold uppercase tracking-widest">Data tidak ditemukan</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deletingId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Hapus Transaksi?</h3>
            <p className="text-sm text-text-muted mb-6">Data pembayaran ini akan dihapus secara permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleDelete} className="btn btn-danger flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AcademicSummaryReport({ filteredPayments }: { filteredPayments: Payment[] }) {
  const formatNum = (num: number) => Math.round(num).toLocaleString('id-ID');
  
  const classGroups: Record<string, { total: number, students: Record<string, { name: string, total: number }> }> = {};
  
  filteredPayments.forEach(p => {
    if (!classGroups[p.studentClass]) {
      classGroups[p.studentClass] = {
        total: 0,
        students: {}
      };
    }
    const studentIdentifier = p.studentNis || p.studentName;
    if (!classGroups[p.studentClass].students[studentIdentifier]) {
       classGroups[p.studentClass].students[studentIdentifier] = {
         name: p.studentName,
         total: 0
       };
    }
    classGroups[p.studentClass].total += p.totalAmount;
    classGroups[p.studentClass].students[studentIdentifier].total += p.totalAmount;
  });

  const sortedClasses = Object.keys(classGroups).sort();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {sortedClasses.length === 0 ? (
        <div className="py-16 text-center text-text-muted border-2 border-dashed border-border rounded-xl">
          <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
          <p className="text-xs font-bold uppercase tracking-widest">Data tidak ditemukan</p>
        </div>
      ) : (
        sortedClasses.map(c => {
          const group = classGroups[c];
          const sortedStudents = Object.values(group.students).sort((a, b) => a.name.localeCompare(b.name));
          
          return (
            <div key={c} className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-border">
                <h4 className="font-bold text-text-main text-sm">Kelas {c}</h4>
                <p className="font-bold text-accent">Rp {formatNum(group.total)}</p>
              </div>
              <div className="px-6 py-2 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-[10px] text-text-muted uppercase tracking-widest font-bold border-b border-border">
                    <tr>
                      <th className="py-3 w-10">No</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4 text-right">Total Disetorkan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-slate-50/50 transition-colors text-[13px]">
                        <td className="py-3 text-text-muted">{i + 1}</td>
                        <td className="py-3 px-4 font-medium text-text-main">{s.name}</td>
                        <td className="py-3 px-4 text-right font-bold text-text-main">Rp {formatNum(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AcademicMonthlyReport({ payments, activeYear, category, endDate }: { payments: Payment[], activeYear: AcademicYear, category: string, endDate: string }) {
  const formatNum = (num: number) => Math.round(num).toLocaleString('id-ID');
  
  // Filter payments by category
  const filteredPayments = payments.filter(p => {
    if (category === '7') return p.studentClass.startsWith('7') && p.type !== 'arrears';
    if (category === '8') return p.studentClass.startsWith('8') && p.type !== 'arrears';
    if (category === '9') return p.studentClass.startsWith('9') && p.type !== 'arrears';
    if (category === 'all') return p.type !== 'arrears';
    if (category === 'tanggungan') return p.type === 'arrears';
    return true;
  });

  const monthsList = [
    { name: 'Juli', value: 6 },
    { name: 'Agustus', value: 7 },
    { name: 'September', value: 8 },
    { name: 'Oktober', value: 9 },
    { name: 'November', value: 10 },
    { name: 'Desember', value: 11 },
    { name: 'Januari', value: 0 },
    { name: 'Februari', value: 1 },
    { name: 'Maret', value: 2 },
    { name: 'April', value: 3 },
    { name: 'Mei', value: 4 },
    { name: 'Juni', value: 5 }
  ];

  const allocations = [...activeYear.allocations].sort((a, b) => a.priority - b.priority);

  // Group by month value (0-11)
  const groupedByMonth: Record<number, { allocations: Record<string, number>, total: number }> = {};
  monthsList.forEach(m => {
    groupedByMonth[m.value] = { allocations: {}, total: 0 };
    allocations.forEach(a => groupedByMonth[m.value].allocations[a.id] = 0);
  });

  filteredPayments.forEach(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    const monthVal = d.getMonth();
    
    if (groupedByMonth[monthVal]) {
      groupedByMonth[monthVal].total += p.totalAmount;
      Object.keys(p.allocations || {}).forEach(k => {
        if (groupedByMonth[monthVal].allocations[k] !== undefined) {
          groupedByMonth[monthVal].allocations[k] += p.allocations[k];
        }
      });
    }
  });

  const totals = { allocations: {} as Record<string, number>, grandTotal: 0 };
  allocations.forEach(a => totals.allocations[a.id] = 0);

  Object.values(groupedByMonth).forEach(g => {
    totals.grandTotal += g.total;
    Object.keys(g.allocations).forEach(k => {
      totals.allocations[k] += g.allocations[k] || 0;
    });
  });

  let titleRows = [];
  if (category === 'tanggungan') {
     titleRows.push("PENERIMAAN TANGGUNGAN SUMBANGAN KOMITE");
     let classStr = "KELAS VII, VIII, IX";
     titleRows.push(`${classStr} TAHUN AJARAN ${activeYear.id.replace('_', '/')}`);
  } else {
     titleRows.push("PENERIMAAN SUMBANGAN KOMITE");
     let classStr = "KELAS VII, VIII, IX";
     if (category === '7') classStr = "KELAS VII";
     if (category === '8') classStr = "KELAS VIII";
     if (category === '9') classStr = "KELAS IX";
     titleRows.push(`${classStr} TAHUN AJARAN ${activeYear.id.replace('_', '/')}`);
  }

  return (
    <div className="w-full bg-white text-black p-8 font-sans overflow-x-auto min-w-max border border-gray-300">
      <div className="text-center font-bold mb-4">
        {titleRows.map((tr, idx) => <h2 key={idx} className="text-lg uppercase">{tr}</h2>)}
        <h3 className="text-base font-bold">Per {format(new Date(endDate), 'dd MMMM yyyy', { locale: id })}</h3>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead className="font-bold border-y-2 border-y-blue-800">
          <tr>
            <th className="border-r border-black p-2 text-center w-32 border-l border-y-black">Bulan</th>
            {allocations.map(a => (
              <th key={a.id} className="border-r border-black p-2 text-center border-y-black">{a.name}</th>
            ))}
            <th className="border-r border-black p-2 text-center border-y-black w-40">Jumlah</th>
          </tr>
        </thead>
        <tbody className="border-b-2 border-b-blue-800">
          {monthsList.map(m => {
            const data = groupedByMonth[m.value];
            return (
               <tr key={m.value} className="hover:bg-slate-50">
                 <td className="border-r border-b border-black p-2 font-bold border-l">{m.name}</td>
                 {allocations.map(a => (
                   <td key={a.id} className="border-r border-b border-black p-2 text-right tracking-tight font-mono">
                     {data.allocations[a.id] > 0 ? formatNum(data.allocations[a.id]) : '-'}
                   </td>
                 ))}
                 <td className="border-r border-b border-black p-2 text-right tracking-tight border-l-2 font-mono">
                   {data.total > 0 ? formatNum(data.total) : '-'}
                 </td>
               </tr>
            );
          })}
          <tr className="font-bold border-b-2 border-b-blue-800 bg-slate-50 border-t-2 border-t-black">
             <td className="border-r border-black p-2 border-l">Jumlah</td>
             {allocations.map(a => (
               <td key={a.id} className="border-r border-black p-2 text-right tracking-tight font-mono">
                  {totals.allocations[a.id] > 0 ? formatNum(totals.allocations[a.id]) : '-'}
               </td>
             ))}
             <td className="border-r border-black p-2 text-right tracking-tight border-l-2 font-mono">
                {totals.grandTotal > 0 ? formatNum(totals.grandTotal) : '-'}
             </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ClassArrearsReport({ students, selectedClass, activeYear }: { students: Student[], selectedClass: string, activeYear: AcademicYear }) {
  const classStudents = students
    .filter(s => s.class === selectedClass && s.status !== 'lulus')
    .sort((a, b) => a.name.localeCompare(b.name));

  const formatNum = (num: number) => Math.round(num).toLocaleString('id-ID');

  const getKeterangan = (student: Student) => {
    if (student.status === 'keluar') return 'Siswa Keluar';
    if (student.status === 'keringanan' && student.discountAmount) {
      return `Keringanan Rp${formatNum(student.discountAmount)},-`;
    }
    if (student.status === 'yatim') {
      const tabungan = activeYear.allocations.find(a => a.isTabungan)?.amount || 0;
      return `Hanya bayar rekreasi Rp${formatNum(tabungan)},-`;
    }
    return '';
  };

  const renderCellContent = (detail: any, prevClass?: string) => {
    const months = typeof detail === 'number' ? detail / activeYear.defaultMonthlyAmount : detail?.months || 0;
    const total = typeof detail === 'number' ? detail : detail?.total || 0;
    
    if (total === 0 && !prevClass) return <div className="text-center font-bold">-</div>;
    
    if (total === 0) {
       return (
         <div className="flex items-center w-full">
           <span className="w-12 text-center">{prevClass || ''}</span>
           <span className="flex-1 text-center font-bold">-</span>
         </div>
       );
    }
    
    return (
      <div className="flex items-center w-full gap-2">
        {prevClass ? <span className="w-8 text-center">{prevClass}</span> : null}
        <span className="flex-1 pl-2 text-left whitespace-nowrap">{months} bulan</span>
        <span className="text-center px-1">-</span>
        <span className="w-16 text-right whitespace-nowrap">{formatNum(total)}</span>
      </div>
    );
  };
  
  const getTotals = (s: Student) => {
     const t7 = getArrearsDisplay(s, 'class7', activeYear.id).total;
     const t8 = getArrearsDisplay(s, 'class8', activeYear.id).total;
     const t9 = getArrearsDisplay(s, 'class9', activeYear.id).total;
     return { t7, t8, t9, total: t7 + t8 + t9 };
  };

  const grandTotal = classStudents.reduce((acc, s) => acc + getTotals(s).total, 0);

  return (
    <div className="w-full bg-white text-black p-8 font-sans overflow-x-auto min-w-max border border-gray-300">
      <div className="text-center font-bold mb-6">
        <h2 className="text-lg uppercase">TANGGUNGAN KOMITE SISWA</h2>
        <h2 className="text-lg uppercase">SMP NEGERI 2 TUREN</h2>
        <h3 className="text-base uppercase">TAHUN AJARAN {activeYear.id.replace('_', '/')}</h3>
        <h3 className="text-base uppercase">KELAS {selectedClass}</h3>
      </div>

      <table className="w-full border-collapse border border-black text-xs">
        <thead className="bg-[#f0f0f0] font-bold">
          <tr>
            <th className="border border-black p-1 text-center" rowSpan={2}>No.</th>
            <th className="border border-black p-2 text-center" rowSpan={2}>NAMA</th>
            <th className="border border-black p-1 text-center whitespace-nowrap" rowSpan={2}>NOMOR<br/>INDUK</th>
            <th className="border border-black p-1 text-center" colSpan={3}>KEKURANGAN</th>
            <th className="border border-black p-1 text-center" rowSpan={2}>Jumlah</th>
            <th className="border border-black p-2 text-center" rowSpan={2}>KETERANGAN</th>
          </tr>
          <tr>
            <th className="border border-black p-1 text-center w-40">Kelas 7</th>
            <th className="border border-black p-1 text-center w-40">Kelas 8</th>
            <th className="border border-black p-1 text-center w-40">Kelas 9</th>
          </tr>
        </thead>
        <tbody>
          {classStudents.map((s, idx) => {
            const totals = getTotals(s);
            let bgClass = "bg-white";
            if (s.status === 'keluar') bgClass = "bg-[#70ad47] text-white";
            else if (s.status === 'yatim') bgClass = "bg-[#d9d9d9]";

            return (
              <tr key={s.id} className={bgClass}>
                <td className="border border-black p-1 text-right">{idx + 1}</td>
                <td className="border border-black p-1 whitespace-nowrap px-2">{s.name}</td>
                <td className="border border-black p-1 text-center">{s.nis || '-'}</td>
                <td className="border border-black p-1 px-2">{renderCellContent(getArrearsDisplay(s, 'class7', activeYear.id), s.previousClasses?.class7)}</td>
                <td className="border border-black p-1 px-2">{renderCellContent(getArrearsDisplay(s, 'class8', activeYear.id), s.previousClasses?.class8)}</td>
                <td className="border border-black p-1 px-2">{renderCellContent(getArrearsDisplay(s, 'class9', activeYear.id))}</td>
                <td className="border border-black p-1 text-right px-2">
                  {totals.total > 0 ? formatNum(totals.total) : '-'}
                </td>
                <td className="border border-black p-1 px-2">{getKeterangan(s)}</td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="border border-black p-1 text-center uppercase" colSpan={6}>TOTAL</td>
            <td className="border border-black p-1 text-right px-2">{formatNum(grandTotal)}</td>
            <td className="border border-black p-1"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-4 border border-black bg-[#d9d9d9]"></div>
          <span>Anak Yatim/Yatim Piatu</span>
          <div className="ml-auto flex items-center justify-end text-xs text-gray-600 italic">
            Terakhir Diperbarui : {format(new Date(), 'dd MMMM yyyy HH:mm')} WIB
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-4 border border-black bg-[#d9d9d9]"></div>
          <span>Anak Yatim/Yatim Piatu hanya kurang bayar rekreasi</span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-4 border border-black bg-[#70ad47]"></div>
          <span>Siswa Keluar</span>
        </div>
        
        <p>- Lunas jika kolom Jumlah kosong (berisi -)</p>
        <p>- Normalnya Rp{formatNum(activeYear.defaultMonthlyAmount)},- per bulan</p>
      </div>
    </div>
  );
}

function SettingsView({ settings, activeYear, academicYears, selectedYearId, students, setSelectedYearId, isAdmin }: { 
  settings: SystemSettings, 
  activeYear?: AcademicYear,
  academicYears: AcademicYear[],
  selectedYearId: string | null,
  students: Student[],
  setSelectedYearId: (id: string) => void,
  isAdmin?: boolean
}) {
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [localYear, setLocalYear] = useState<AcademicYear | undefined>(activeYear);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasYearChanges, setHasYearChanges] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', amount: 0, isTabungan: false });
  const [newYear, setNewYear] = useState({ label: '' });
  const [isPromoting, setIsPromoting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState({ current: 0, total: 0 });
  const [promotionSearch, setPromotionSearch] = useState('');
  const [customPromotions, setCustomPromotions] = useState<{nis: string, oldClass: string, newClass: string, name: string}[]>([]);
  const [promotionConfig, setPromotionConfig] = useState<{
    targetYearId: string;
    excludeStudentIds: string[];
  }>({ targetYearId: '', excludeStudentIds: [] });

  const [backupYearId, setBackupYearId] = useState<string>('all');
  const [deleteMode, setDeleteMode] = useState<'' | 'payments_only' | 'payments_and_progress' | 'paid_students' | 'all'>('');
  const [deleteYearId, setDeleteYearId] = useState<string>('');
  const [isDeletingDB, setIsDeletingDB] = useState(false);
  const [dbOpProgress, setDbOpProgress] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setLocalSettings(settings);
    }
  }, [settings, hasChanges]);

  useEffect(() => {
    if (!hasYearChanges) {
      setLocalYear(activeYear);
    }
  }, [activeYear, hasYearChanges]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (hasChanges) {
        await setDoc(doc(db, 'settings', 'defaults'), localSettings);
        setHasChanges(false);
      }
      if (hasYearChanges && localYear) {
        await updateDoc(doc(db, 'academic_years', localYear.id), {
          defaultMonthlyAmount: localYear.defaultMonthlyAmount,
          allocations: localYear.allocations
        });
        setHasYearChanges(false);
      }
      alert('Pengaturan berhasil disimpan!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/defaults');
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    if (!newItem.name || !localYear) return;
    let id = newItem.name.toLowerCase().replace(/\s+/g, '_');
    let counter = 1;
    const baseId = id;
    while (localYear.allocations.some(a => a.id === id)) {
      id = `${baseId}_${counter}`;
      counter++;
    }

    const priority = localYear.allocations.length > 0 
      ? Math.max(...localYear.allocations.map(a => a.priority)) + 1 
      : 1;
    
    setLocalYear({
      ...localYear,
      allocations: [...localYear.allocations, { ...newItem, id, priority }]
    });
    setHasYearChanges(true);
    setNewItem({ name: '', amount: 0, isTabungan: false });
  };

  const removeItem = (id: string) => {
    if (!localYear) return;
    setLocalYear({
      ...localYear,
      allocations: localYear.allocations.filter(a => a.id !== id)
    });
    setHasYearChanges(true);
  };

  const moveItem = (indexInSorted: number, direction: 'up' | 'down') => {
    if (!localYear) return;
    setLocalYear(prev => {
      if (!prev) return prev;
      const sorted = [...prev.allocations].sort((a, b) => b.priority - a.priority);
      const targetIndex = direction === 'up' ? indexInSorted - 1 : indexInSorted + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return prev;

      const newSorted = [...sorted];
      const temp = newSorted[indexInSorted];
      newSorted[indexInSorted] = newSorted[targetIndex];
      newSorted[targetIndex] = temp;

      const updatedAllocations = prev.allocations.map(a => {
        const foundIdx = newSorted.findIndex(s => s.id === a.id);
        return { ...a, priority: newSorted.length - foundIdx };
      });

      return { ...prev, allocations: updatedAllocations };
    });
    setHasYearChanges(true);
  };

  const handleAddYear = async () => {
    if (!newYear.label) return;
    const id = newYear.label.replace(/\//g, '_');
    const baseYear = academicYears.find(y => y.id === settings.currentAcademicYearId) || academicYears[0];
    const yearData: AcademicYear = {
      id,
      label: newYear.label,
      isActive: false,
      createdAt: serverTimestamp(),
      defaultMonthlyAmount: baseYear?.defaultMonthlyAmount || 150000,
      allocations: baseYear?.allocations || DEFAULT_ALLOCATIONS
    };
    try {
      await setDoc(doc(db, 'academic_years', id), yearData);
      setNewYear({ label: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'academic_years');
    }
  };

  const handleSetActiveYear = async (yearId: string) => {
    try {
      // Update all years to inactive
      const batch = academicYears.map(y => 
        updateDoc(doc(db, 'academic_years', y.id), { isActive: y.id === yearId })
      );
      await Promise.all(batch);
      // Update settings
      await setDoc(doc(db, 'settings', 'defaults'), { currentAcademicYearId: yearId }, { merge: true });
      setSelectedYearId(yearId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/defaults');
    }
  };

  const downloadPromotionTemplate = () => {
    const header = "NIS,Nama Siswa,Kelas Sekarang,Kelas Baru\n";
    // Pre-fill with active students
    const rows = students.filter(s => s.isActive).map(s => {
       const escapedName = s.name.includes(',') ? `"${s.name}"` : s.name;
       return `${s.nis},${escapedName},${s.class},`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template_Kenaikan_Kelas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [promotionStatus, setPromotionStatus] = useState({ type: '', message: '' });

  const handlePromotionImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPromotionStatus({ type: '', message: '' });
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        setPromotionStatus({ type: 'error', message: 'File CSV kosong atau format tidak sesuai.' });
        return;
      }

      const header = lines[0].toLowerCase();
      const isSemicolon = header.includes(';');
      const separator = isSemicolon ? ';' : ',';
      const dataLines = lines.slice(1).filter(l => l.trim() !== '');
      
      const parsed = [];
      let matchCount = 0;
      for (const line of dataLines) {
        let cols = [];
        if (line.includes('"')) {
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
              inQuotes = !inQuotes;
            } else if (line[i] === separator && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += line[i];
            }
          }
          cols.push(current.trim());
        } else {
          cols = line.split(separator).map(c => c.trim());
        }

        if (cols.length < 1 || !cols[0]) continue;
        const nis = cols[0];
        const name = cols[1] || '';
        const oldClass = cols[2] || '';
        const newClass = cols[3] || '';
        parsed.push({ nis, name, oldClass, newClass });
        matchCount++;
      }
      setCustomPromotions(parsed);
      setPromotionStatus({ type: 'success', message: `Berhasil memuat data CSV untuk ${matchCount} siswa.` });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportBackup = async () => {
    setIsBackingUp(true);
    setDbOpProgress("Menyiapkan struktur backup...");
    try {
      const backupData: any = {
        timestamp: new Date().toISOString(),
        settings: {},
        academic_years: [],
        alumni: [],
        payments: []
      };

      try {
        setDbOpProgress("Mengambil Pengaturan...");
        const setDocRef = await getDocs(collection(db, 'settings'));
        setDocRef.forEach(d => { backupData.settings[d.id] = d.data(); });
      } catch (e) {}

      try {
        setDbOpProgress("Mengambil Tahun Ajaran, Daftar Kelas, & Siswa...");
        const aySnap = await getDocs(collection(db, 'academic_years'));
        for (const docSnap of aySnap.docs) {
           if (backupYearId !== 'all' && docSnap.id !== backupYearId) continue;
           const ay = { id: docSnap.id, ...docSnap.data(), students: [] as any[], classes: [] as any[] };
           const stSnap = await getDocs(collection(db, 'academic_years', docSnap.id, 'students'));
           stSnap.forEach(s => ay.students.push({ id: s.id, ...s.data() }));
           const clSnap = await getDocs(collection(db, 'academic_years', docSnap.id, 'classes'));
           clSnap.forEach(c => ay.classes.push({ id: c.id, ...c.data() }));
           backupData.academic_years.push(ay);
        }
      } catch(e) {}

      if (backupYearId === 'all') {
        try {
          setDbOpProgress("Mengambil Data Alumni...");
          const alSnap = await getDocs(collection(db, 'alumni'));
          alSnap.forEach(a => backupData.alumni.push({ id: a.id, ...a.data() }));
        } catch (e) {}
      }

      try {
        setDbOpProgress("Mengambil Data Transaksi Pembayaran...");
        let yrIds = backupYearId === 'all' ? academicYears.map(y => y.id) : [backupYearId];
        for (const yid of yrIds) {
          const pySnap = await getDocs(collection(db, 'academic_years', yid, 'payments'));
          pySnap.forEach(p => {
            const data = p.data();
            backupData.payments.push({ id: p.id, ...data });
          });
        }
      } catch (e) {}
      
      setDbOpProgress("Menyusun File JSON & Mengunduh...");
      const replacer = (key: string, value: any) => {
        if (value && typeof value === 'object' && typeof value.toDate === 'function') {
           return value.toDate().toISOString();
        }
        return value;
      };

      const jsonStr = JSON.stringify(backupData, replacer, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_spp_${backupYearId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
       console.error("Backup failed", e);
       alert("Gagal melakukan backup.");
    } finally {
      setIsBackingUp(false);
      setDbOpProgress('');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("PERINGATAN: Memulihkan database ini akan MENAMBAH/MENIMPA data saat ini dengan data dari file backup. Lanjutkan?")) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    setDbOpProgress("Membaca file cadangan...");
    try {
       const text = await file.text();
       const data = JSON.parse(text);
       
       const restoreCollection = async (collPath: string, items: any[]) => {
          const batchArray = [];
          for (let i = 0; i < items.length; i += 500) {
             const batch = items.slice(i, i+500);
             setDbOpProgress(`Pemulihan (${collPath}): Memproses ${Math.min(i+500, items.length)} / ${items.length} data...`);
             batchArray.push(
               Promise.all(batch.map(item => {
                 const { id, ...rest } = item;
                 const reviveTimestamps = (obj: any) => {
                    for (const k in obj) {
                       if (typeof obj[k] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj[k])) {
                          obj[k] = new Date(obj[k]);
                       } else if (obj[k] !== null && typeof obj[k] === 'object') {
                          reviveTimestamps(obj[k]);
                       }
                    }
                 };
                 reviveTimestamps(rest);
                 return setDoc(doc(db, collPath, id), rest);
               }))
             );
             // await in loop to show progress properly
             await Promise.all(batchArray);
             batchArray.length = 0;
          }
       }

       if (data.settings) {
         setDbOpProgress("Memulihkan Pengaturan...");
         for (const k of Object.keys(data.settings)) {
           await setDoc(doc(db, 'settings', k), data.settings[k]);
         }
       }

       if (data.academic_years) {
         for (const ay of data.academic_years) {
            setDbOpProgress(`Memulihkan Tahun Ajaran: ${ay.id}`);
            const { students, classes, id, ...rest } = ay;
            await setDoc(doc(db, 'academic_years', id), rest);
            if (students) await restoreCollection(`academic_years/${id}/students`, students);
            if (classes) await restoreCollection(`academic_years/${id}/classes`, classes);
         }
       }

       if (data.alumni) await restoreCollection('alumni', data.alumni);
       
       if (data.payments) {
          const batchArray = [];
          for (let i = 0; i < data.payments.length; i += 500) {
             const batch = data.payments.slice(i, i+500);
             setDbOpProgress(`Pemulihan Transaksi Pembayaran: Memproses ${Math.min(i+500, data.payments.length)} / ${data.payments.length} data...`);
             batchArray.push(
               Promise.all(batch.map((item: any) => {
                 const { id, ...rest } = item;
                 const reviveTimestamps = (obj: any) => {
                    for (const k in obj) {
                       if (typeof obj[k] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj[k])) {
                          obj[k] = new Date(obj[k]);
                       } else if (obj[k] !== null && typeof obj[k] === 'object') {
                          reviveTimestamps(obj[k]);
                       }
                    }
                 };
                 reviveTimestamps(rest);
                 const yid = rest.academicYearId || (data.academic_years && data.academic_years[0]?.id) || 'unknown';
                 if (yid !== 'unknown') {
                   return setDoc(doc(db, 'academic_years', yid, 'payments', id), rest);
                 }
                 return Promise.resolve();
               }))
             );
             await Promise.all(batchArray);
             batchArray.length = 0;
          }
       }

       setDbOpProgress("Menyelesaikan pemulihan...");
       alert("Pemulihan data berhasil! Halaman akan dimuat ulang.");
       window.location.reload();

    } catch (error) {
       console.error("Restore failed:", error);
       alert("Gagal memulihkan database. Periksa console untuk memverifikasi struktur file.");
    } finally {
       setIsRestoring(false);
       setDbOpProgress('');
       if(e.target) e.target.value = '';
    }
  };

  const requestDeleteDB = () => {
    if (!deleteYearId || !deleteMode) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteDB = async () => {
    if (!deleteYearId || !deleteMode) return;
    setShowDeleteConfirm(false);

    setIsDeletingDB(true);
    setDbOpProgress("Memulai proses penghapusan...");
    try {
      if (deleteMode === 'payments_only' || deleteMode === 'all' || deleteMode === 'payments_and_progress') {
        setDbOpProgress("Mengumpulkan data pembayaran...");
        const yearRef = doc(db, 'academic_years', deleteYearId);
        const paySnap = await getDocs(collection(yearRef, 'payments'));
        const docsToDelete = paySnap.docs;

        if (deleteMode === 'payments_and_progress') {
           const diffs: Record<string, { class7: number, class8: number, class9: number }> = {};
           for (const docSnap of docsToDelete) {
              const p = docSnap.data() as Payment;
              if (!diffs[p.studentId]) diffs[p.studentId] = { class7: 0, class8: 0, class9: 0 };
              if (p.type === 'arrears' && p.arrearsClass) {
                 diffs[p.studentId][p.arrearsClass] += p.totalAmount;
              } else {
                 const currentClassPrefix = p.studentClass.charAt(0);
                 if (['7', '8', '9'].includes(currentClassPrefix)) {
                    diffs[p.studentId][`class${currentClassPrefix}` as 'class7'|'class8'|'class9'] += p.totalAmount;
                 }
              }
           }
           
           setDbOpProgress("Mengecek progress tunggakan siswa yang akan direset...");
           const stSnap = await getDocs(collection(yearRef, 'students'));
           let scurrentBatch = [];
           let processedStudent = 0;
           for (const docSnap of stSnap.docs) {
              const sid = docSnap.id;
              if (diffs[sid]) {
                 const s = docSnap.data() as Student;
                 const getDetail = (key: 'class7'|'class8'|'class9') => {
                    const detail = s.arrears ? s.arrears[key] : { monthlyRate: 0, total: 0, months: 0 };
                    return typeof detail === 'number' ? { monthlyRate: detail > 0 ? Math.ceil(detail/12) : 150000, total: detail, months: 0 } : { ...detail };
                 };
                 const c7 = getDetail('class7');
                 const c8 = getDetail('class8');
                 const c9 = getDetail('class9');
                 
                 c7.total += diffs[sid].class7;
                 c7.months = c7.monthlyRate > 0 ? c7.total / c7.monthlyRate : 0;
                 
                 c8.total += diffs[sid].class8;
                 c8.months = c8.monthlyRate > 0 ? c8.total / c8.monthlyRate : 0;
                 
                 c9.total += diffs[sid].class9;
                 c9.months = c9.monthlyRate > 0 ? c9.total / c9.monthlyRate : 0;
                 
                 let newArrearsMonths = c7.months + c8.months + c9.months;
                 
                 scurrentBatch.push(updateDoc(docSnap.ref, {
                    'arrears.class7': c7,
                    'arrears.class8': c8,
                    'arrears.class9': c9,
                    'arrearsMonths': newArrearsMonths
                 }));
                 if (scurrentBatch.length >= 500) {
                    await Promise.all(scurrentBatch);
                    processedStudent += scurrentBatch.length;
                    setDbOpProgress(`Mengembalikan Tunggakan Siswa: ${processedStudent}`);
                    scurrentBatch = [];
                 }
              }
           }
           if (scurrentBatch.length > 0) {
               await Promise.all(scurrentBatch);
               processedStudent += scurrentBatch.length;
               setDbOpProgress(`Mengembalikan Tunggakan Siswa: ${processedStudent}`);
           }
        }
        
        const batchArray = [];
        let currentBatch = [];
        let deleted = 0;
        for (const docSnap of docsToDelete) {
          currentBatch.push(deleteDoc(doc(db, 'academic_years', deleteYearId, 'payments', docSnap.id)));
          if (currentBatch.length >= 500) {
            await Promise.all(currentBatch);
            deleted += currentBatch.length;
            setDbOpProgress(`Menghapus Pembayaran: ${deleted} dari ${docsToDelete.length}`);
            currentBatch = [];
          }
        }
        if (currentBatch.length > 0) {
           await Promise.all(currentBatch);
           deleted += currentBatch.length;
           setDbOpProgress(`Menghapus Pembayaran: ${deleted} dari ${docsToDelete.length}`);
        }
      }

      if (deleteMode === 'paid_students') {
         setDbOpProgress("Mengumpulkan data siswa...");
         const stSnap = await getDocs(collection(db, 'academic_years', deleteYearId, 'students'));
         let currentBatch = [];
         let processed = 0;
         
         const targetDocs = stSnap.docs.filter(docSnap => {
            const s = docSnap.data() as Student;
            const getT = (v: any) => typeof v === 'number' ? v : (v?.total || 0);
            return s.status === 'lulus' || (s.arrearsMonths === 0 && (getT(s.arrears?.class7) === 0 && getT(s.arrears?.class8) === 0 && getT(s.arrears?.class9) === 0));
         });

         for (const docSnap of targetDocs) {
            const s = docSnap.data() as Student;
            const simplified = {
               id: s.id,
               nis: s.nis,
               name: s.name,
               class: s.class,
               status: 'lulus',
               previousClasses: s.previousClasses,
               graduatedYear: s.graduatedYear || deleteYearId.replace('_','/'),
               isSimplified: true
            };
            currentBatch.push(setDoc(doc(db, 'academic_years', deleteYearId, 'students', s.id), simplified));
            if (currentBatch.length >= 500) {
              await Promise.all(currentBatch);
              processed += currentBatch.length;
              setDbOpProgress(`Membersihkan Data Siswa Lunas: ${processed} dari ${targetDocs.length}`);
              currentBatch = [];
            }
         }
         if (currentBatch.length > 0) {
            await Promise.all(currentBatch);
            processed += currentBatch.length;
            setDbOpProgress(`Membersihkan Data Siswa Lunas: ${processed} dari ${targetDocs.length}`);
         }
      }

      if (deleteMode === 'all') {
         // delete students
         setDbOpProgress("Mengumpulkan data siswa...");
         const stSnap = await getDocs(collection(db, 'academic_years', deleteYearId, 'students'));
         let currentBatch = [];
         let processed = 0;
         for (const docSnap of stSnap.docs) {
            currentBatch.push(deleteDoc(doc(db, 'academic_years', deleteYearId, 'students', docSnap.id)));
            if (currentBatch.length >= 500) {
               await Promise.all(currentBatch);
               processed += currentBatch.length;
               setDbOpProgress(`Menghapus Siswa: ${processed} dari ${stSnap.docs.length}`);
               currentBatch = [];
            }
         }
         if (currentBatch.length > 0) {
            await Promise.all(currentBatch);
            processed += currentBatch.length;
            setDbOpProgress(`Menghapus Siswa: ${processed} dari ${stSnap.docs.length}`);
         }
         
         // delete classes
         setDbOpProgress("Menghapus data kelas...");
         const clSnap = await getDocs(collection(db, 'academic_years', deleteYearId, 'classes'));
         currentBatch = [];
         for (const docSnap of clSnap.docs) {
            currentBatch.push(deleteDoc(doc(db, 'academic_years', deleteYearId, 'classes', docSnap.id)));
            if (currentBatch.length >= 500) {
               await Promise.all(currentBatch);
               currentBatch = [];
            }
         }
         if (currentBatch.length > 0) await Promise.all(currentBatch);

         // delete academic year info
         setDbOpProgress("Menghapus konfigurasi tahun ajaran...");
         await deleteDoc(doc(db, 'academic_years', deleteYearId));
         
         if (settings.currentAcademicYearId === deleteYearId) {
             const nextAy = academicYears.find(y => y.id !== deleteYearId);
             if (nextAy) {
                 await setDoc(doc(db, 'settings', 'defaults'), { currentAcademicYearId: nextAy.id }, { merge: true });
             }
         }
      }

      setDeleteMode('');
      setDbOpProgress('Selesai!');
      alert("Proses penghapusan data berhasil diselesaikan!");
      if (deleteMode === 'all') window.location.reload();
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsDeletingDB(false);
      setDbOpProgress('');
    }
  };

  const handlePromote = async () => {
    if (!promotionConfig.targetYearId) {
      setPromotionStatus({ type: 'error', message: 'Pilih tahun ajaran tujuan terlebih dahulu.' });
      return;
    }

    setPromotionStatus({ type: '', message: '' });
    setIsSaving(true);
    try {
      const sourceYearRef = doc(db, 'academic_years', settings.currentAcademicYearId);
      const targetYearRef = doc(db, 'academic_years', promotionConfig.targetYearId);
      const sourceYearObj = academicYears.find(y => y.id === settings.currentAcademicYearId);
      const sourceYearLabel = sourceYearObj ? sourceYearObj.label : settings.currentAcademicYearId;

      // 1. Get all students from current year
      const studentsSnap = await getDocs(collection(sourceYearRef, 'students'));
      const studentsToPromote = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      
      setPromotionProgress({ current: 0, total: studentsToPromote.length });

      // 2. Process each student
      let processedCount = 0;
      const batch = studentsToPromote.map(async (student) => {
        if (promotionConfig.excludeStudentIds.includes(student.id)) {
          setPromotionProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return;
        }

        const currentClass = student.class;
        let grade = parseInt(currentClass);
        if (isNaN(grade)) grade = 0;
        let nextClass = currentClass;
        let isActive = student.isActive;
        let status = student.status;
        let isNotPromoted = false;

        const custom = customPromotions.find(c => c.nis === student.nis);
        
        if (customPromotions.length > 0) {
          if (!custom) {
            setPromotionProgress(prev => ({ ...prev, current: prev.current + 1 }));
            return; // Skip students not in CSV
          }
          if (!custom.newClass) {
            isNotPromoted = true;
            nextClass = currentClass;
          } else if (custom.newClass.toLowerCase() === 'lulus') {
            if (student.status === 'keluar') {
              // Rule: Keluar students cannot graduate
              isNotPromoted = true;
              nextClass = currentClass;
            } else {
              isActive = false;
              status = 'lulus';
              nextClass = currentClass; // Keep their last class for record
            }
          } else {
            nextClass = custom.newClass;
          }
        } else {
          if (grade === 7) {
            nextClass = currentClass.replace('7', '8');
          } else if (grade === 8) {
            nextClass = currentClass.replace('8', '9');
          } else if (grade === 9) {
            if (student.status === 'keluar') {
              // Rule: Keluar students cannot graduate automatically
              isNotPromoted = true;
              nextClass = currentClass;
            } else {
              isActive = false; // Graduated
              status = 'lulus';
            }
          }
        }

        if (isNotPromoted) {
           isActive = student.isActive;
           status = student.status;
        }

        // Calculate total arrears to carry over
        const getArrearsVal = (v: any) => typeof v === 'number' ? v : v?.total || 0;
        
        const monthlyBase = student.customMonthlyAmount || activeYear?.defaultMonthlyAmount || 0;

        const arrears7 = student.arrears?.class7;
        const arrears8 = student.arrears?.class8;
        const arrears9 = student.arrears?.class9;
        
        const targetYearObj = academicYears.find(y => y.id === promotionConfig.targetYearId);
        const nextMonthlyBase = student.customMonthlyAmount || targetYearObj?.defaultMonthlyAmount || activeYear?.defaultMonthlyAmount || 0;

        const getOldArrears = (arr: any) => ({
          months: typeof arr === 'object' ? (arr?.months || 0) : 0,
          monthlyRate: typeof arr === 'object' ? (arr?.monthlyRate || nextMonthlyBase) : nextMonthlyBase,
          total: getArrearsVal(arr)
        });

        const newArrears = {
          class7: getOldArrears(arrears7),
          class8: getOldArrears(arrears8),
          class9: getOldArrears(arrears9)
        };

        const nextGrade = parseInt(nextClass);
        if (status !== 'lulus' && status !== 'keluar' && isActive) {
          if (nextGrade === 7) {
            newArrears.class7.months += 12;
            newArrears.class7.monthlyRate = nextMonthlyBase;
            newArrears.class7.total += (12 * nextMonthlyBase);
          } else if (nextGrade === 8) {
             newArrears.class8.months += 12;
             newArrears.class8.monthlyRate = nextMonthlyBase;
             newArrears.class8.total += (12 * nextMonthlyBase);
          } else if (nextGrade === 9) {
             newArrears.class9.months += 12;
             newArrears.class9.monthlyRate = nextMonthlyBase;
             newArrears.class9.total += (12 * nextMonthlyBase);
          }
        }
        
        const isCurrentlyGraduating = grade === 9 && status === 'lulus' && student.status !== 'lulus';
        const historicalAllocations = (status === 'lulus' || student.status === 'lulus') 
          ? (student.historicalAllocations || activeYear.allocations) 
          : undefined;
        const historicalMonthlyAmount = (status === 'lulus' || student.status === 'lulus') 
          ? (student.historicalMonthlyAmount || activeYear.defaultMonthlyAmount) 
          : undefined;

        // Prepare new student data for target year
        const newStudentData: any = {
          ...student,
          class: nextClass,
          isActive,
          status,
          graduatedYear: status === 'lulus' ? sourceYearLabel : student.graduatedYear,
          previousClasses: {
            class7: grade === 7 ? currentClass : (student.previousClasses?.class7 || ''),
            class8: grade === 8 ? currentClass : (student.previousClasses?.class8 || '')
          },
          arrears: newArrears,
          arrearsMonths: newArrears.class7.months + newArrears.class8.months + newArrears.class9.months,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (historicalAllocations !== undefined) {
          newStudentData.historicalAllocations = historicalAllocations;
        } else {
          delete newStudentData.historicalAllocations;
        }

        if (historicalMonthlyAmount !== undefined) {
          newStudentData.historicalMonthlyAmount = historicalMonthlyAmount;
        } else {
          delete newStudentData.historicalMonthlyAmount;
        }

        Object.keys(newStudentData).forEach(key => newStudentData[key] === undefined && delete newStudentData[key]);

        // Save to target year or alumni
        if (status === 'lulus') {
          // Add to alumni collection
          await setDoc(doc(db, 'alumni', student.id), {
            ...newStudentData,
            isAlumni: true
          });
          // Also set them to lulus in the SOURCE year, so it reflects immediately that they graduated!
          await updateDoc(doc(sourceYearRef, 'students', student.id), {
             isActive: false, status: 'lulus', isAlumni: true, updatedAt: serverTimestamp()
          });
        } else {
          // Save to target year
          await setDoc(doc(targetYearRef, 'students', student.id), newStudentData);
        }
        setPromotionProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      await Promise.all(batch);
      
      // 3. Copy classes to target year
      const classesSnap = await getDocs(collection(sourceYearRef, 'classes'));
      const classesBatch = classesSnap.docs.map(async (d) => {
        const classData = d.data();
        const grade = parseInt(classData.name);
        let nextClassName = classData.name;
        if (grade === 7) nextClassName = classData.name.replace('7', '8');
        else if (grade === 8) nextClassName = classData.name.replace('8', '9');
        else return; // Don't copy grade 9 classes as they graduate

        await setDoc(doc(targetYearRef, 'classes', d.id), {
          ...classData,
          name: nextClassName
        });
      });
      await Promise.all(classesBatch);

      setPromotionStatus({ type: 'success', message: 'Proses kenaikan kelas berhasil diselesaikan!' });
      setTimeout(() => {
        setIsPromoting(false);
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'promotion');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedAllocations = localYear ? [...localYear.allocations].sort((a, b) => b.priority - a.priority) : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-text-main mb-6">Manajemen Tahun Ajaran</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Tahun Ajaran Aktif</label>
            <div className="space-y-2">
              {academicYears.map(year => (
                <div key={year.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-border rounded-lg">
                  <span className="font-medium">Tahun Ajaran {year.label}</span>
                  {year.isActive ? (
                    <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full uppercase">Aktif</span>
                  ) : (
                    <button 
                      onClick={() => handleSetActiveYear(year.id)}
                      className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase hover:bg-slate-300 transition-colors"
                    >
                      Set Aktif
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 border-2 border-dashed border-border rounded-xl">
            <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Tambah Tahun Ajaran</h4>
            <div className="flex gap-3">
              <input 
                placeholder="Contoh: 2024/2025"
                className="input-field py-2"
                value={newYear.label}
                onChange={e => setNewYear({ label: e.target.value })}
              />
              <button 
                onClick={handleAddYear}
                className="btn btn-primary"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border">
          <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Fitur Naik Kelas</h4>
          <p className="text-xs text-text-muted mb-6">Gunakan fitur ini untuk memindahkan siswa ke tingkat kelas berikutnya dan memindahkan sisa tunggakan ke tahun ajaran baru.</p>
          <button 
            onClick={() => setIsPromoting(true)}
            className="btn btn-primary"
          >
            <UserPlus size={18} />
            Proses Naik Kelas
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-text-main mb-6">Konfigurasi Dasar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="max-w-xs">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Jumlah Default (Rp)</label>
            <input 
              type="number"
              className="input-field text-lg font-bold py-2"
              value={localYear?.defaultMonthlyAmount || 0}
              onChange={e => {
                if (localYear) {
                  setLocalYear({ ...localYear, defaultMonthlyAmount: Number(e.target.value) });
                  setHasYearChanges(true);
                }
              }}
            />
          </div>
          <div className="max-w-xs">
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Daftar Akun Administrator</label>
            <div className="space-y-2 mb-6">
              {(localSettings.adminEmails || ['m.alvin2564@admin.smp.belajar.id']).map((email, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="email"
                    className="flex-1 px-3 py-2 bg-slate-50/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent/50 text-sm"
                    value={email}
                    onChange={e => {
                      const newEmails = [...(localSettings.adminEmails || ['m.alvin2564@admin.smp.belajar.id'])];
                      newEmails[idx] = e.target.value;
                      setLocalSettings({ ...localSettings, adminEmails: newEmails });
                      setHasChanges(true);
                    }}
                    disabled={email === "m.alvin2564@admin.smp.belajar.id"} // Master admin tidak bisa diubah langsung di sini
                  />
                  <button 
                    onClick={() => {
                      if (email === "m.alvin2564@admin.smp.belajar.id") return; // Cegah hapus master
                      const newEmails = (localSettings.adminEmails || []).filter((_, i) => i !== idx);
                      setLocalSettings({ ...localSettings, adminEmails: newEmails });
                      setHasChanges(true);
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors border",
                      email === "m.alvin2564@admin.smp.belajar.id" 
                        ? "text-slate-300 border-transparent cursor-not-allowed" 
                        : "text-text-muted hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-100"
                    )}
                    title={email === "m.alvin2564@admin.smp.belajar.id" ? "Master Admin tidak bisa dihapus" : "Hapus Admin"}
                    disabled={email === "m.alvin2564@admin.smp.belajar.id"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setLocalSettings({ 
                    ...localSettings, 
                    adminEmails: [...(localSettings.adminEmails || ['m.alvin2564@admin.smp.belajar.id']), ''] 
                  });
                  setHasChanges(true);
                }}
                className="text-[11px] font-bold text-accent uppercase tracking-wider hover:underline"
              >
                + Tambah Administrator Baru
              </button>
            </div>

            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Daftar Akun Kasir</label>
            <div className="space-y-2">
              {(localSettings.cashierEmails || []).map((email, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="email"
                    className="flex-1 px-3 py-2 bg-slate-50/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent/50 text-sm"
                    value={email}
                    onChange={e => {
                      const newEmails = [...(localSettings.cashierEmails || [])];
                      newEmails[idx] = e.target.value;
                      setLocalSettings({ ...localSettings, cashierEmails: newEmails });
                      setHasChanges(true);
                    }}
                  />
                  <button 
                    onClick={() => {
                      const newEmails = (localSettings.cashierEmails || []).filter((_, i) => i !== idx);
                      setLocalSettings({ ...localSettings, cashierEmails: newEmails });
                      setHasChanges(true);
                    }}
                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Hapus Email"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setLocalSettings({ ...localSettings, cashierEmails: [...(localSettings.cashierEmails || []), ''] });
                  setHasChanges(true);
                }}
                className="text-[11px] font-bold text-accent uppercase tracking-wider hover:underline"
              >
                + Tambah Email Kasir
              </button>
            </div>

            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 mt-6">Daftar Akun Supervisor (Hanya Melihat)</label>
            <div className="space-y-2">
              {(localSettings.supervisorEmails || []).map((email, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="email"
                    className="flex-1 px-3 py-2 bg-slate-50/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent/50 text-sm"
                    value={email}
                    onChange={e => {
                      const newEmails = [...(localSettings.supervisorEmails || [])];
                      newEmails[idx] = e.target.value;
                      setLocalSettings({ ...localSettings, supervisorEmails: newEmails });
                      setHasChanges(true);
                    }}
                  />
                  <button 
                    onClick={() => {
                      const newEmails = (localSettings.supervisorEmails || []).filter((_, i) => i !== idx);
                      setLocalSettings({ ...localSettings, supervisorEmails: newEmails });
                      setHasChanges(true);
                    }}
                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Hapus Email"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setLocalSettings({ ...localSettings, supervisorEmails: [...(localSettings.supervisorEmails || []), ''] });
                  setHasChanges(true);
                }}
                className="text-[11px] font-bold text-accent uppercase tracking-wider hover:underline"
              >
                + Tambah Email Supervisor
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-text-main">Alokasi Dana</h3>
          <p className="text-xs text-text-muted">Total Alokasi: <span className="font-bold text-accent">{formatCurrency(localYear?.allocations.reduce((sum, a) => sum + a.amount, 0) || 0)}</span></p>
        </div>

        <div className="space-y-4 mb-8">
          {sortedAllocations.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-4 p-4 bg-slate-50/50 border border-border rounded-xl group">
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => moveItem(idx, 'up')} 
                  className="p-1 text-text-muted hover:text-accent hover:bg-accent/10 rounded disabled:opacity-20 transition-colors" 
                  disabled={idx === 0}
                  title="Pindahkan ke atas"
                >
                  <ChevronUp size={16} />
                </button>
                <button 
                  onClick={() => moveItem(idx, 'down')} 
                  className="p-1 text-text-muted hover:text-accent hover:bg-accent/10 rounded disabled:opacity-20 transition-colors" 
                  disabled={idx === sortedAllocations.length - 1}
                  title="Pindahkan ke bawah"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Nama Item</label>
                  <input 
                    className="w-full bg-transparent font-medium text-sm outline-none"
                    value={a.name}
                    onChange={e => {
                      if (!localYear) return;
                      const newAlloc = localYear.allocations.map(item => 
                        item.id === a.id ? { ...item, name: e.target.value } : item
                      );
                      setLocalYear({ ...localYear, allocations: newAlloc });
                      setHasYearChanges(true);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Jumlah (Rp)</label>
                  <input 
                    type="number"
                    className="w-full bg-transparent font-bold text-sm outline-none"
                    value={a.amount}
                    onChange={e => {
                      if (!localYear) return;
                      const newAlloc = localYear.allocations.map(item => 
                        item.id === a.id ? { ...item, amount: Number(e.target.value) } : item
                      );
                      setLocalYear({ ...localYear, allocations: newAlloc });
                      setHasYearChanges(true);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={a.isTabungan} 
                    onChange={e => {
                      if (!localYear) return;
                      const newAlloc = localYear.allocations.map(item => 
                        item.id === a.id ? { ...item, isTabungan: e.target.checked } : item
                      );
                      setLocalYear({ ...localYear, allocations: newAlloc });
                      setHasYearChanges(true);
                    }}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-[10px] font-bold text-text-muted uppercase">Rekreasi</span>
                </label>
                <button 
                  onClick={() => removeItem(a.id)}
                  className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-2 border-dashed border-border rounded-xl">
          <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Tambah Item Alokasi</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Nama Alokasi</label>
              <input 
                placeholder="Contoh: Pramuka"
                className="w-full px-4 py-2 bg-white border border-border rounded-lg outline-none text-sm"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Jumlah (Rp)</label>
              <input 
                type="number"
                placeholder="0"
                className="w-full px-4 py-2 bg-white border border-border rounded-lg outline-none text-sm"
                value={newItem.amount || ''}
                onChange={e => setNewItem({ ...newItem, amount: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={newItem.isTabungan}
                  onChange={e => setNewItem({ ...newItem, isTabungan: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-[10px] font-bold text-text-muted uppercase">Rekreasi</span>
              </label>
              <button 
                onClick={addItem}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-text-main">Pencadangan & Pemulihan (Backup/Restore)</h3>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6">
             <p className="text-sm text-amber-800 leading-relaxed">
               Pencadangan akan mengunduh seluruh data (Pengaturan, Tahun Ajaran, Daftar Siswa, Kelas, Alumni, dan Riwayat Pembayaran) dalam bentuk file JSON. Fitur pemulihan akan memasukkan kembali data tersebut ke dalam sistem. Gunakan dengan sangat hati-hati.
             </p>
          </div>
          
          <div className="mb-6 max-w-sm">
             <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Pilih Data Cadangan</label>
             <select 
               className="input-field"
               value={backupYearId}
               onChange={e => setBackupYearId(e.target.value)}
             >
               <option value="all">Seluruh Database</option>
               {academicYears.map(y => (
                 <option key={y.id} value={y.id}>Hanya Tahun Ajaran: {y.label}</option>
               ))}
             </select>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
             <button
               onClick={handleExportBackup}
               disabled={isBackingUp || isRestoring}
               className="btn btn-secondary flex items-center gap-2"
             >
               <Download size={18} />
               {isBackingUp ? "Mencadangkan..." : "Cadangkan Database"}
             </button>
             
             <label className={`btn bg-slate-100 text-slate-700 hover:bg-slate-200 border-none flex items-center gap-2 cursor-pointer ${(isRestoring || isBackingUp) ? 'opacity-50 pointer-events-none' : ''}`}>
               <Upload size={18} />
               {isRestoring ? "Memulihkan..." : "Pulihkan Database"}
               <input
                 type="file"
                 accept=".json"
                 className="hidden"
                 onChange={handleRestoreBackup}
                 disabled={isRestoring || isBackingUp}
               />
             </label>
          </div>
          {(isBackingUp || isRestoring) && dbOpProgress && (
             <div className="text-sm text-accent font-medium mt-2 animate-pulse flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                 {dbOpProgress}
             </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-text-main">Hapus Data Berdasarkan Tahun Ajaran</h3>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
             <p className="text-sm text-red-800 leading-relaxed font-bold">
               PERINGATAN: Data yang dihapus tidak dapat dikembalikan. Sangat disarankan untuk mengunduh Cadangan Database sebelum menghapus.
             </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
               <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Tahun Ajaran Target</label>
               <select 
                 className="input-field border-red-200 focus:border-red-500 focus:ring-red-500/20"
                 value={deleteYearId}
                 onChange={e => setDeleteYearId(e.target.value)}
               >
                 <option value="">-- Pilih Tahun Ajaran --</option>
                 {academicYears.map(y => (
                   <option key={y.id} value={y.id}>{y.label}</option>
                 ))}
               </select>
            </div>
            <div>
               <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Mode Penghapusan</label>
               <select 
                 className="input-field border-red-200 focus:border-red-500 focus:ring-red-500/20"
                 value={deleteMode}
                 onChange={e => setDeleteMode(e.target.value as any)}
               >
                 <option value="">-- Pilih Mode --</option>
                 <option value="payments_only">1. Hapus Pembayaran Saja (Data & Tunggakan Siswa Tetap Aman)</option>
                 <option value="payments_and_progress">2. Hapus Pembayaran dan Kembalikan Tunggakan (Tunggakan di-reset kembali seperti sebelum dibayar pada tahun target)</option>
                 <option value="paid_students">3. Hapus Siswa Lunas (Hanya Sisa NIS, Nama, Riwayat)</option>
                 <option value="all">4. Hapus Semua Data Pada Tahun Ajaran Tersebut</option>
               </select>
            </div>
          </div>
          
          <button
             disabled={!deleteYearId || !deleteMode || isDeletingDB}
             onClick={requestDeleteDB}
             className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:bg-red-300 w-full sm:w-auto px-8"
          >
             {isDeletingDB ? "Memproses Penghapusan..." : "Jalankan Penghapusan"}
          </button>
          
          {isDeletingDB && dbOpProgress && (
             <div className="text-sm text-red-600 font-medium mt-4 animate-pulse flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                 {dbOpProgress}
             </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-8">
        {(hasChanges || hasYearChanges) && (
          <button 
            onClick={() => {
              setLocalSettings(settings);
              setHasChanges(false);
              setLocalYear(activeYear);
              setHasYearChanges(false);
            }}
            className="btn btn-secondary px-8"
          >
            Batalkan
          </button>
        )}
        <button 
          onClick={handleSave}
          disabled={isSaving || (!hasChanges && !hasYearChanges)}
          className="btn btn-primary px-10"
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {isPromoting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full p-8 border border-border overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-text-main">Proses Naik Kelas</h3>
              <button onClick={() => setIsPromoting(false)} className="text-text-muted hover:text-text-main"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-sm text-blue-700 leading-relaxed">
                  Fitur ini akan memindahkan seluruh data siswa dari tahun ajaran aktif (<strong>{settings.currentAcademicYearId.replace('_', '/')}</strong>) ke tahun ajaran baru.
                </p>
              </div>

              {promotionStatus.message && (
                <div className={`p-4 rounded-xl border ${promotionStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  <p className="text-sm text-center font-medium">{promotionStatus.message}</p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Pilih Tahun Ajaran Tujuan</label>
                <select 
                  className="input-field"
                  value={promotionConfig.targetYearId}
                  onChange={e => setPromotionConfig({ ...promotionConfig, targetYearId: e.target.value })}
                >
                  <option value="">-- Pilih Tahun Ajaran --</option>
                  {academicYears.filter(y => y.id !== settings.currentAcademicYearId).map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Penentuan Kelas Baru (Opsional)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <label className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg font-bold text-[11px] uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors w-full h-full text-text-main">
                      <Upload size={14} />
                      {customPromotions.length > 0 ? `${customPromotions.length} Penyesuaian Dimuat` : 'Impor CSV Kelas Baru'}
                      <input type="file" accept=".csv" className="hidden" onChange={handlePromotionImport} />
                    </label>
                  </div>
                  <button
                    onClick={downloadPromotionTemplate}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg font-bold text-[11px] uppercase tracking-widest text-text-main hover:bg-slate-50 transition-colors"
                  >
                    <Download size={14} />
                    Unduh Format
                  </button>
                </div>
                {customPromotions.length > 0 && <p className="text-[10px] text-green-600 mt-2 italic">* Hanya {customPromotions.length} siswa dalam file CSV yang akan diproses. Siswa lainnya akan diabaikan.</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Pengecualian Siswa (Tidak Naik Kelas)</label>
                  <div className="relative w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" size={12} />
                    <input
                      type="text"
                      placeholder="Cari siswa..."
                      className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-border rounded outline-none text-xs"
                      value={promotionSearch}
                      onChange={(e) => setPromotionSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {students.filter(s => s.isActive && (s.name.toLowerCase().includes(promotionSearch.toLowerCase()) || s.nis?.includes(promotionSearch))).map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        checked={promotionConfig.excludeStudentIds.includes(s.id)}
                        onChange={e => {
                          const ids = e.target.checked 
                            ? [...promotionConfig.excludeStudentIds, s.id]
                            : promotionConfig.excludeStudentIds.filter(id => id !== s.id);
                          setPromotionConfig({ ...promotionConfig, excludeStudentIds: ids });
                        }}
                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-text-main">{s.name}</span>
                        <span className="text-text-muted ml-2">({s.class})</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-text-muted mt-2 italic">* Siswa yang dicentang tidak akan dialihkan ke database tahun ajaran baru.</p>
              </div>

              {isSaving && promotionProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-accent uppercase tracking-widest">
                    <span>Progres Pengolahan Data siswa</span>
                    <span>{Math.round((promotionProgress.current / promotionProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                    <div 
                      className="h-full bg-accent transition-all duration-300 ease-out"
                      style={{ width: `${(promotionProgress.current / promotionProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-muted text-center italic">
                    Memproses {promotionProgress.current} dari {promotionProgress.total} siswa...
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsPromoting(false)}
                  className="btn btn-secondary flex-1"
                >
                  Batal
                </button>
                <button 
                  onClick={handlePromote}
                  disabled={isSaving || !promotionConfig.targetYearId}
                  className="btn btn-primary flex-1"
                >
                  {isSaving ? 'Memproses...' : 'Mulai Proses'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-border">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
              <AlertCircle size={20} />
              Konfirmasi Penghapusan
            </h3>
            <div className="space-y-4 mb-6">
              {deleteMode === 'payments_only' && (
                <p className="text-sm text-text-main">Apakah Anda yakin ingin <strong className="text-red-600">MENGHAPUS SEMUA DATA PEMBAYARAN</strong> pada tahun ajaran ini? Tunggakan pada data siswa tidak akan di-reset.</p>
              )}
              {deleteMode === 'payments_and_progress' && (
                <div className="space-y-2">
                  <p className="text-sm text-text-main">Apakah Anda yakin ingin <strong className="text-red-600">MENGHAPUS PEMBAYARAN & MENGEMBALIKAN TUNGGAKAN</strong>?</p>
                  <p className="text-xs text-text-muted">Semua riwayat pembayaran di tahun ini akan dihapus, dan tunggakan siswa akan dikembalikan secara persis seolah pembayaran tersebut tidak pernah dilakukan.</p>
                </div>
              )}
              {deleteMode === 'paid_students' && (
                <p className="text-sm text-text-main">Apakah Anda yakin ingin <strong className="text-red-600">MEMBERSIHKAN DATA SISWA LUNAS</strong>? Data siswa lunas hanya akan disisakan NIS, Nama, Riwayat Kelas, dan Keterangan Lunas.</p>
              )}
              {deleteMode === 'all' && (
                <div className="space-y-2">
                  <p className="text-sm text-text-main">Apakah Anda yakin akan <strong className="text-red-600">MENGHAPUS KESELURUHAN DATA</strong> (Siswa, Kelas, Pembayaran, dan Tahun Ajaran itu sendiri)?</p>
                  <p className="text-sm font-bold text-red-600 bg-red-50 p-2 border border-red-200 rounded">PERINGATAN KERAS: Proses ini TIDAK DAPAT DIBATALKAN (No Undo)!</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary px-6"
              >
                Batal
              </button>
              <button 
                onClick={handleDeleteDB}
                className="btn bg-red-600 text-white hover:bg-red-700 px-6"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
