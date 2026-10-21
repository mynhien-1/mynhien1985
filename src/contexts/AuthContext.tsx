import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  supabase,
  signInWithSupabaseEmail as supaSignInEmail,
  signUpWithSupabaseEmail as supaSignUpEmail,
  signInWithSupabaseGoogle as supaSignInGoogle,
  signOutSupabase,
} from '../supabase';
import { localDb } from '../services/localDb';
import { UserProfile, UserRole, SystemConfig, SchoolWorkspace, SchoolGiftRequest } from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_DEPARTMENTS,
  INITIAL_ADMIN_EMAIL,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_SCHOOL_ID,
  DEFAULT_SCHOOL_WORKSPACES,
  DEFAULT_GIFT_REQUESTS,
  generateDefaultStaffForSchool,
} from '../constants';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google-firebase' | 'supabase' | 'direct';
}

interface AuthContextType {
  // Multi-school Workspace
  activeSchool: SchoolWorkspace;
  schoolList: SchoolWorkspace[];
  switchSchool: (schoolId: string) => Promise<void>;
  createSchoolWorkspace: (newSchool: {
    name: string;
    code?: string;
    principalName?: string;
    academicYear?: string;
  }) => Promise<SchoolWorkspace>;
  updateSchoolWorkspace: (schoolId: string, updates: Partial<SchoolWorkspace>) => Promise<void>;
  getSchoolShareLink: (schoolId: string) => string;

  // Owner & School Gift Approval (Chủ sở hữu mynhienbobeo@gmail.com)
  isSystemOwner: boolean;
  systemOwnerEmail: string;
  giftRequests: SchoolGiftRequest[];
  submitGiftSchoolRequest: (data: {
    schoolName: string;
    schoolCode?: string;
    principalName?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    academicYear?: string;
    reasonOrNote?: string;
  }) => Promise<SchoolGiftRequest>;
  approveGiftSchoolRequest: (requestId: string) => Promise<{ school: SchoolWorkspace; shareLink: string }>;
  rejectGiftSchoolRequest: (requestId: string, reason?: string) => Promise<void>;

  // Active User / Profile
  currentUser: AppUser | null;
  userProfile: UserProfile | null;
  systemConfig: SystemConfig | null;
  selectedAcademicYear: string;
  setSelectedAcademicYear: (year: string) => void;
  loading: boolean;
  isAdmin: boolean;
  isVicePrincipal: boolean;
  isLead: boolean;
  isTeacher: boolean;
  isApproved: boolean;

  // Staff list of the active school
  staffList: UserProfile[];
  switchUser: (targetUidOrEmail: string) => Promise<void>;
  addNewStaffMember: (newStaff: Partial<UserProfile>) => Promise<UserProfile>;
  updateStaffMember: (uid: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteStaffMember: (uid: string) => Promise<void>;
  batchImportStaff: (staffList: Partial<UserProfile>[]) => Promise<void>;

  // Fallbacks
  signInWithGoogle: (useRedirect?: boolean) => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInWithSupabaseEmail: (email: string, password: string) => Promise<void>;
  signUpWithSupabaseEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithSupabaseGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Helper to determine initial school
  const getInitialSchool = (): SchoolWorkspace => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const paramSchool = params.get('school') || params.get('schoolId');
        const savedSchoolId =
          paramSchool || localStorage.getItem('school_active_workspace_id');

        const found = DEFAULT_SCHOOL_WORKSPACES.find(
          (s) =>
            s.id === savedSchoolId ||
            s.code.toLowerCase() === savedSchoolId?.toLowerCase()
        );
        if (found) return found;

        const customSchoolsStr = localStorage.getItem('school_workspaces_custom');
        if (customSchoolsStr) {
          const customSchools: SchoolWorkspace[] = JSON.parse(customSchoolsStr);
          const match = customSchools.find(
            (s) =>
              s.id === savedSchoolId ||
              s.code?.toLowerCase() === savedSchoolId?.toLowerCase()
          );
          if (match) return match;
        }
      } catch (e) {
        console.warn('Initial school parse error:', e);
      }
    }
    return DEFAULT_SCHOOL_WORKSPACES[0];
  };

  const initialSchool = getInitialSchool();
  const [activeSchool, setActiveSchool] = useState<SchoolWorkspace>(initialSchool);
  const [schoolList, setSchoolList] = useState<SchoolWorkspace[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const custom = localStorage.getItem('school_workspaces_custom');
        if (custom) {
          const parsed = JSON.parse(custom);
          const map = new Map<string, SchoolWorkspace>();
          DEFAULT_SCHOOL_WORKSPACES.forEach((s) => map.set(s.id, s));
          parsed.forEach((s: SchoolWorkspace) => map.set(s.id, s));
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn('Custom schools parse error:', e);
      }
    }
    return DEFAULT_SCHOOL_WORKSPACES;
  });

  // Helper to determine initial user for a school
  const getInitialUser = (
    schoolId: string
  ): { appUser: AppUser | null; profile: UserProfile | null } => {
    let defaultStaffForSchool: UserProfile[] = DEFAULT_STAFF_MEMBERS;
    if (schoolId !== 'th-ba-chuc') {
      defaultStaffForSchool = generateDefaultStaffForSchool(
        schoolId,
        activeSchool.name || 'Trường học',
        activeSchool.principalName
      );
    }

    let chosen =
      defaultStaffForSchool.find(
        (u) => u.email.toLowerCase() === INITIAL_ADMIN_EMAIL.toLowerCase()
      ) || defaultStaffForSchool[0];

    if (typeof window !== 'undefined') {
      if (localStorage.getItem('school_logged_out') === 'true') {
        return { appUser: null, profile: null };
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const paramUser =
          params.get('user') || params.get('uid') || params.get('email');
        const savedUid =
          paramUser ||
          localStorage.getItem(`school_active_staff_${schoolId}`) ||
          localStorage.getItem('school_active_staff_uid');

        if (savedUid) {
          // Check custom list first
          const customKey = `school_staff_custom_${schoolId}`;
          const customLocal = localStorage.getItem(customKey);
          if (customLocal) {
            try {
              const customStaff: UserProfile[] = JSON.parse(customLocal);
              const customFound = customStaff.find(
                (u) =>
                  u.uid === savedUid ||
                  u.email?.toLowerCase().trim() === savedUid?.toLowerCase().trim()
              );
              if (customFound) chosen = customFound;
            } catch {}
          }

          if (!chosen) {
            const found = defaultStaffForSchool.find(
              (u) =>
                u.uid === savedUid ||
                u.email.toLowerCase().trim() === savedUid?.toLowerCase().trim()
            );
            if (found) {
              chosen = found;
            }
          }
        }
      } catch (e) {
        console.warn('Initial user parse error:', e);
      }
    }

    // Ensure Cô Trương Thị Mỹ Nhiên has correct role and department as Tổ trưởng Tổ Khối 2
    if (
      chosen.email.toLowerCase().trim() === INITIAL_ADMIN_EMAIL.toLowerCase().trim() &&
      schoolId === 'th-ba-chuc'
    ) {
      chosen = {
        ...chosen,
        displayName: 'Cô Trương Thị Mỹ Nhiên',
        positionTitle: 'Tổ trưởng Tổ Khối 2',
        role: 'lead',
        departmentId: 'khoi_2',
        departmentName: 'Tổ Khối 2',
      };
    }

    return {
      appUser: {
        uid: chosen.uid,
        email: chosen.email,
        displayName: chosen.displayName,
        photoURL: chosen.photoURL || null,
        provider: 'direct',
      },
      profile: chosen,
    };
  };

  const initialUserData = getInitialUser(initialSchool.id);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(
    initialUserData.appUser
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    initialUserData.profile
  );
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYearState] = useState<string>(
    initialSchool.currentAcademicYear || '2026-2027'
  );
  const [staffList, setStaffList] = useState<UserProfile[]>(() => {
    if (initialSchool.id === 'th-ba-chuc') {
      return DEFAULT_STAFF_MEMBERS;
    }
    return generateDefaultStaffForSchool(
      initialSchool.id,
      initialSchool.name,
      initialSchool.principalName
    );
  });
  const [loading, setLoading] = useState(false);

  // School Gift Requests state & sync
  const [giftRequests, setGiftRequests] = useState<SchoolGiftRequest[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('school_gift_requests_custom');
        if (local) {
          const parsed = JSON.parse(local);
          const map = new Map<string, SchoolGiftRequest>();
          DEFAULT_GIFT_REQUESTS.forEach((r) => map.set(r.id, r));
          parsed.forEach((r: SchoolGiftRequest) => map.set(r.id, r));
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn('Gift requests parse error:', e);
      }
    }
    return DEFAULT_GIFT_REQUESTS;
  });

  // 1. Sync gift requests locally
  useEffect(() => {
    try {
      const local = localStorage.getItem('school_gift_requests_custom');
      const parsed = local ? JSON.parse(local) : [];
      const map = new Map<string, SchoolGiftRequest>();
      DEFAULT_GIFT_REQUESTS.forEach((r) => map.set(r.id, r));
      parsed.forEach((r: SchoolGiftRequest) => map.set(r.id, r));
      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setGiftRequests(list);
    } catch {
      setGiftRequests(DEFAULT_GIFT_REQUESTS);
    }
  }, []);

  // 2. Sync schools collection locally in background
  useEffect(() => {
    try {
      const local = localStorage.getItem('school_workspaces_custom');
      const parsed = local ? JSON.parse(local) : [];
      const map = new Map<string, SchoolWorkspace>();
      DEFAULT_SCHOOL_WORKSPACES.forEach((s) => map.set(s.id, s));
      parsed.forEach((s: SchoolWorkspace) => map.set(s.id, s));
      const list = Array.from(map.values());
      setSchoolList(list);

      const updatedActive = map.get(activeSchool.id);
      if (updatedActive) {
        setActiveSchool(updatedActive);
      }
    } catch {
      setSchoolList(DEFAULT_SCHOOL_WORKSPACES);
    }
  }, [activeSchool.id]);

  // 3. Listen to Staff list for the ACTIVE school locally
  useEffect(() => {
    const deletedKey = `school_deleted_staff_${activeSchool.id}`;
    const customKey = `school_staff_custom_${activeSchool.id}`;

    let deletedUids = new Set<string>();
    try {
      const delRaw = localStorage.getItem(deletedKey);
      if (delRaw) deletedUids = new Set(JSON.parse(delRaw));
    } catch {}

    const defaultForSchool =
      activeSchool.id === 'th-ba-chuc'
        ? DEFAULT_STAFF_MEMBERS
        : generateDefaultStaffForSchool(
            activeSchool.id,
            activeSchool.name,
            activeSchool.principalName
          );

    try {
      const local = localStorage.getItem(customKey);
      if (local) {
        // Authoritative custom list
        const parsed: UserProfile[] = JSON.parse(local);
        const filtered = parsed.filter((p) => !deletedUids.has(p.uid));
        // Sanitize: BGH (Hiệu trưởng / Phó Hiệu trưởng) must NEVER be assigned to a grade block (khoi_1..5)
        const sanitized = filtered.map((p) => {
          const posLower = (p.positionTitle || '').toLowerCase();
          const deptNameLower = (p.departmentName || '').toLowerCase();
          const isBgh =
            p.role === 'admin' ||
            p.role === 'vice_principal' ||
            posLower.includes('hiệu trưởng') ||
            posLower.includes('giám hiệu') ||
            posLower.includes('bgh') ||
            deptNameLower.includes('giám hiệu') ||
            p.departmentId === 'bgh';

          if (isBgh) {
            const isVice = p.role === 'vice_principal' || posLower.includes('phó');
            return {
              ...p,
              role: isVice ? ('vice_principal' as const) : ('admin' as const),
              departmentId: '',
              departmentName: 'Ban Giám Hiệu',
            };
          }
          return p;
        });
        setStaffList(sanitized);
        if (typeof window !== 'undefined') {
          localStorage.setItem(customKey, JSON.stringify(sanitized));
        }
        localDb.saveStaff(sanitized, activeSchool.id);

        if (currentUser?.uid) {
          const matched = sanitized.find((p) => p.uid === currentUser.uid);
          if (matched) setUserProfile(matched);
        }
        return;
      }
    } catch (e) {
      console.warn('Error reading local staff:', e);
    }

    // First time initialization ONLY
    const initialList = defaultForSchool
      .filter((m) => !deletedUids.has(m.uid))
      .map((p) => {
        const posLower = (p.positionTitle || '').toLowerCase();
        const deptNameLower = (p.departmentName || '').toLowerCase();
        const isBgh =
          p.role === 'admin' ||
          p.role === 'vice_principal' ||
          posLower.includes('hiệu trưởng') ||
          posLower.includes('giám hiệu') ||
          posLower.includes('bgh') ||
          deptNameLower.includes('giám hiệu') ||
          p.departmentId === 'bgh';

        if (isBgh) {
          const isVice = p.role === 'vice_principal' || posLower.includes('phó');
          return {
            ...p,
            role: isVice ? ('vice_principal' as const) : ('admin' as const),
            departmentId: '',
            departmentName: 'Ban Giám Hiệu',
          };
        }
        return p;
      });
    setStaffList(initialList);
    if (typeof window !== 'undefined') {
      localStorage.setItem(customKey, JSON.stringify(initialList));
    }
    localDb.saveStaff(initialList, activeSchool.id);

    if (currentUser?.uid) {
      const matched = initialList.find((p) => p.uid === currentUser.uid);
      if (matched) setUserProfile(matched);
    }
  }, [activeSchool.id, currentUser?.uid]);

  // 3. Switch School Workspace
  const switchSchool = async (schoolId: string) => {
    const targetSchool = schoolList.find((s) => s.id === schoolId);
    if (!targetSchool) return;

    setActiveSchool(targetSchool);
    setSelectedAcademicYearState(targetSchool.currentAcademicYear || '2026-2027');

    if (typeof window !== 'undefined') {
      localStorage.setItem('school_active_workspace_id', targetSchool.id);
      const url = new URL(window.location.href);
      url.searchParams.set('school', targetSchool.id);
      // Remove specific user param so it defaults properly
      url.searchParams.delete('user');
      url.searchParams.delete('uid');
      window.history.replaceState({}, '', url.toString());
    }

    const userInit = getInitialUser(targetSchool.id);
    setCurrentUser(userInit.appUser);
    setUserProfile(userInit.profile);
  };

  // 4. Create a new independent School Workspace
  const createSchoolWorkspace = async (newSchool: {
    name: string;
    code?: string;
    principalName?: string;
    academicYear?: string;
  }): Promise<SchoolWorkspace> => {
    const slug =
      (newSchool.code || newSchool.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `truong-${Date.now()}`;

    const schoolObj: SchoolWorkspace = {
      id: slug,
      name: newSchool.name.trim(),
      code: (newSchool.code || slug).toUpperCase(),
      principalName: newSchool.principalName?.trim() || 'Thầy/Cô Hiệu Trưởng',
      currentAcademicYear: newSchool.academicYear || '2026-2027',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save custom school locally
    if (typeof window !== 'undefined') {
      const existingCustom = JSON.parse(
        localStorage.getItem('school_workspaces_custom') || '[]'
      );
      const updatedCustom = [
        ...existingCustom.filter((s: SchoolWorkspace) => s.id !== slug),
        schoolObj,
      ];
      localStorage.setItem(
        'school_workspaces_custom',
        JSON.stringify(updatedCustom)
      );
    }

    // Seed initial staff for this new school locally
    const initialStaff = generateDefaultStaffForSchool(
      slug,
      schoolObj.name,
      schoolObj.principalName
    );
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_staff_custom_${slug}`, JSON.stringify(initialStaff));
    }

    setSchoolList((prev) => [...prev.filter((s) => s.id !== slug), schoolObj]);
    await switchSchool(slug);
    return schoolObj;
  };

  // Owner authority check: only mynhienbobeo@gmail.com has full ownership
  const isSystemOwner = Boolean(
    currentUser?.email?.toLowerCase().trim() === INITIAL_ADMIN_EMAIL.toLowerCase().trim() ||
    userProfile?.email?.toLowerCase().trim() === INITIAL_ADMIN_EMAIL.toLowerCase().trim()
  );
  const systemOwnerEmail = INITIAL_ADMIN_EMAIL;

  // Submit request to gift app to another school
  const submitGiftSchoolRequest = async (data: {
    schoolName: string;
    schoolCode?: string;
    principalName?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    academicYear?: string;
    reasonOrNote?: string;
  }): Promise<SchoolGiftRequest> => {
    const slug =
      (data.schoolCode || data.schoolName)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `truong-${Date.now()}`;

    const newReqId = `req-${Date.now()}`;
    const newReq: SchoolGiftRequest = {
      id: newReqId,
      schoolName: data.schoolName.trim(),
      schoolCode: (data.schoolCode || slug).toUpperCase(),
      principalName: data.principalName?.trim() || 'Thầy/Cô Hiệu Trưởng',
      requesterName: data.requesterName?.trim() || userProfile?.displayName || 'Cán bộ giáo viên',
      requesterEmail: data.requesterEmail?.trim() || currentUser?.email || 'chua_co_email@truong.edu.vn',
      requesterPhone: data.requesterPhone?.trim() || '',
      academicYear: data.academicYear || '2026-2027',
      reasonOrNote: data.reasonOrNote?.trim() || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // If submitted by owner (mynhienbobeo@gmail.com), auto-approve & provision immediately
    if (isSystemOwner) {
      newReq.status = 'approved';
      newReq.approvedAt = new Date().toISOString();
      newReq.approvedBy = INITIAL_ADMIN_EMAIL;
      newReq.createdSchoolId = slug;

      await createSchoolWorkspace({
        name: newReq.schoolName,
        code: newReq.schoolCode,
        principalName: newReq.principalName,
        academicYear: newReq.academicYear,
      });
    }

    setGiftRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReqId)]);

    if (typeof window !== 'undefined') {
      const existing = JSON.parse(
        localStorage.getItem('school_gift_requests_custom') || '[]'
      );
      localStorage.setItem(
        'school_gift_requests_custom',
        JSON.stringify([newReq, ...existing.filter((r: SchoolGiftRequest) => r.id !== newReqId)])
      );
    }
    return newReq;
  };

  // Owner approves gift request
  const approveGiftSchoolRequest = async (
    requestId: string
  ): Promise<{ school: SchoolWorkspace; shareLink: string }> => {
    const target = giftRequests.find((r) => r.id === requestId);
    if (!target) throw new Error('Không tìm thấy yêu cầu tặng app');

    // Create the actual school workspace
    const school = await createSchoolWorkspace({
      name: target.schoolName,
      code: target.schoolCode,
      principalName: target.principalName,
      academicYear: target.academicYear,
    });

    const updatedReq: SchoolGiftRequest = {
      ...target,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: INITIAL_ADMIN_EMAIL,
      createdSchoolId: school.id,
    };

    setGiftRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );

    if (typeof window !== 'undefined') {
      const existing = JSON.parse(
        localStorage.getItem('school_gift_requests_custom') || '[]'
      );
      localStorage.setItem(
        'school_gift_requests_custom',
        JSON.stringify(
          existing.map((r: SchoolGiftRequest) => (r.id === requestId ? updatedReq : r))
        )
      );
    }

    const shareLink = getSchoolShareLink(school.id);
    return { school, shareLink };
  };

  // Owner rejects gift request
  const rejectGiftSchoolRequest = async (requestId: string, reason?: string) => {
    const target = giftRequests.find((r) => r.id === requestId);
    if (!target) return;

    const updatedReq: SchoolGiftRequest = {
      ...target,
      status: 'rejected',
      rejectionReason: reason || 'Chủ sở hữu từ chối phê duyệt yêu cầu tặng app.',
    };

    setGiftRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );

    if (typeof window !== 'undefined') {
      const existing = JSON.parse(
        localStorage.getItem('school_gift_requests_custom') || '[]'
      );
      localStorage.setItem(
        'school_gift_requests_custom',
        JSON.stringify(
          existing.map((r: SchoolGiftRequest) => (r.id === requestId ? updatedReq : r))
        )
      );
    }
  };

  // 5. Update school workspace details
  const updateSchoolWorkspace = async (
    schoolId: string,
    updates: Partial<SchoolWorkspace>
  ) => {
    const updated = {
      ...activeSchool,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setActiveSchool(updated);
    setSchoolList((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, ...updates } : s))
    );

    if (typeof window !== 'undefined') {
      const existingCustom = JSON.parse(
        localStorage.getItem('school_workspaces_custom') || '[]'
      );
      const updatedCustom = existingCustom.map((s: SchoolWorkspace) =>
        s.id === schoolId ? { ...s, ...updates } : s
      );
      localStorage.setItem(
        'school_workspaces_custom',
        JSON.stringify(updatedCustom)
      );
    }
  };

  // 6. Generate direct shareable link for a school
  const getSchoolShareLink = (schoolId: string): string => {
    if (typeof window === 'undefined') return `?school=${schoolId}`;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?school=${schoolId}`;
  };

  // 7. Switch active staff member inside current school
  const switchUser = async (targetUidOrEmail: string) => {
    const target = staffList.find(
      (u) =>
        u.uid === targetUidOrEmail ||
        u.email.toLowerCase().trim() === targetUidOrEmail.toLowerCase().trim()
    );

    if (target) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('school_logged_out');
        localStorage.setItem(`school_active_staff_${activeSchool.id}`, target.uid);
        localStorage.setItem('school_active_staff_uid', target.uid);
        localStorage.setItem(`school_user_profile_${target.uid}`, JSON.stringify(target));
      }
      const appUser: AppUser = {
        uid: target.uid,
        email: target.email,
        displayName: target.displayName,
        photoURL: target.photoURL || null,
        provider: 'direct',
      };
      setCurrentUser(appUser);
      setUserProfile(target);
    }
  };

  // 8. Add a new teacher to current school
  const addNewStaffMember = async (
    newStaff: Partial<UserProfile>
  ): Promise<UserProfile> => {
    const prefix = activeSchool.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const newUid = `${prefix}_gv_${Date.now()}`;
    const posLower = (newStaff.positionTitle || '').toLowerCase();
    const deptNameLower = (newStaff.departmentName || '').toLowerCase();
    const isBgh =
      newStaff.role === 'admin' ||
      newStaff.role === 'vice_principal' ||
      posLower.includes('hiệu trưởng') ||
      posLower.includes('giám hiệu') ||
      posLower.includes('bgh') ||
      deptNameLower.includes('giám hiệu') ||
      newStaff.departmentId === 'bgh';

    const isVice = newStaff.role === 'vice_principal' || posLower.includes('phó');
    const role: UserRole = isBgh ? (isVice ? 'vice_principal' : 'admin') : (newStaff.role || 'teacher');

    const staffObj: UserProfile = {
      uid: newUid,
      schoolId: activeSchool.id,
      email: newStaff.email || `${newUid}@school.edu.vn`,
      displayName: newStaff.displayName || (isBgh ? (role === 'admin' ? 'Hiệu trưởng' : 'Phó Hiệu trưởng') : 'Giáo viên mới'),
      positionTitle: newStaff.positionTitle || (isBgh ? (role === 'admin' ? 'Hiệu trưởng' : 'Phó Hiệu trưởng') : ''),
      role,
      departmentId: isBgh ? '' : (newStaff.departmentId || 'khoi_1'),
      departmentName: isBgh ? 'Ban Giám Hiệu' : (newStaff.departmentName || 'Tổ Khối 1'),
      status: newStaff.status || 'active',
      phone: newStaff.phone || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove from deleted set if it existed
    if (typeof window !== 'undefined') {
      const deletedKey = `school_deleted_staff_${activeSchool.id}`;
      try {
        const raw = localStorage.getItem(deletedKey);
        if (raw) {
          const set = new Set(JSON.parse(raw));
          if (set.has(newUid)) {
            set.delete(newUid);
            localStorage.setItem(deletedKey, JSON.stringify(Array.from(set)));
          }
        }
      } catch {}
    }

    const updated = [...staffList, staffObj];
    setStaffList(updated);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_staff_custom_${activeSchool.id}`, JSON.stringify(updated));
    }
    localDb.saveStaff(updated, activeSchool.id);

    // Sync to Supabase
    try {
      supabase.from('profiles').upsert({
        uid: staffObj.uid,
        school_id: activeSchool.id,
        email: staffObj.email,
        display_name: staffObj.displayName,
        position_title: staffObj.positionTitle,
        role: staffObj.role,
        department_id: staffObj.departmentId,
        department_name: staffObj.departmentName,
        status: staffObj.status,
        phone: staffObj.phone,
        updated_at: staffObj.updatedAt,
      }).then();
    } catch {}

    return staffObj;
  };

  // 9. Edit an existing teacher's name, role, position, department
  const updateStaffMember = async (
    uid: string,
    updates: Partial<UserProfile>
  ) => {
    const updatedList = staffList.map((s) => {
      if (s.uid === uid) {
        const nextRole = updates.role || s.role;
        const posLower = (updates.positionTitle !== undefined ? updates.positionTitle : s.positionTitle || '').toLowerCase();
        const deptNameLower = (updates.departmentName !== undefined ? updates.departmentName : s.departmentName || '').toLowerCase();
        const isBgh =
          nextRole === 'admin' ||
          nextRole === 'vice_principal' ||
          posLower.includes('hiệu trưởng') ||
          posLower.includes('giám hiệu') ||
          posLower.includes('bgh') ||
          deptNameLower.includes('giám hiệu') ||
          updates.departmentId === 'bgh';

        const isVice = nextRole === 'vice_principal' || posLower.includes('phó');
        const resolvedRole: UserRole = isBgh ? (isVice ? 'vice_principal' : 'admin') : nextRole;

        return {
          ...s,
          ...updates,
          role: resolvedRole,
          schoolId: activeSchool.id,
          departmentId: isBgh ? '' : (updates.departmentId !== undefined ? updates.departmentId : s.departmentId),
          departmentName: isBgh ? 'Ban Giám Hiệu' : (updates.departmentName !== undefined ? updates.departmentName : s.departmentName),
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    setStaffList(updatedList);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_staff_custom_${activeSchool.id}`, JSON.stringify(updatedList));
    }
    localDb.saveStaff(updatedList, activeSchool.id);

    if (currentUser?.uid === uid) {
      const fresh = updatedList.find((s) => s.uid === uid);
      if (fresh) {
        setUserProfile(fresh);
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: fresh.displayName,
                email: fresh.email,
              }
            : null
        );
      }
    }

    // Sync to Supabase
    try {
      const fresh = updatedList.find((s) => s.uid === uid);
      if (fresh) {
        supabase.from('profiles').upsert({
          uid: fresh.uid,
          school_id: activeSchool.id,
          email: fresh.email,
          display_name: fresh.displayName,
          position_title: fresh.positionTitle,
          role: fresh.role,
          department_id: fresh.departmentId,
          department_name: fresh.departmentName,
          status: fresh.status,
          phone: fresh.phone,
          updated_at: fresh.updatedAt,
        }).then();
      }
    } catch {}
  };

  // 10. Delete a teacher from current school permanently
  const deleteStaffMember = async (uid: string) => {
    // Record into deleted tombstone so default staff never resurrects it
    if (typeof window !== 'undefined') {
      const deletedKey = `school_deleted_staff_${activeSchool.id}`;
      try {
        const raw = localStorage.getItem(deletedKey);
        const set = new Set(raw ? JSON.parse(raw) : []);
        set.add(uid);
        localStorage.setItem(deletedKey, JSON.stringify(Array.from(set)));
      } catch {}
    }

    const updated = staffList.filter((s) => s.uid !== uid);
    setStaffList(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_staff_custom_${activeSchool.id}`, JSON.stringify(updated));
    }
    localDb.saveStaff(updated, activeSchool.id);

    // Sync deletion to Supabase
    try {
      supabase.from('profiles').delete().eq('uid', uid).then();
    } catch {}
  };

  // 11. Batch import staff members
  const batchImportStaff = async (items: Partial<UserProfile>[]) => {
    const prefix = activeSchool.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const newStaffObjects: UserProfile[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.displayName?.trim()) continue;
      const uid = `${prefix}_gv_${Date.now()}_${i}`;
      const posLower = (it.positionTitle || '').toLowerCase();
      const deptNameLower = (it.departmentName || '').toLowerCase();
      const isBgh =
        it.role === 'admin' ||
        it.role === 'vice_principal' ||
        posLower.includes('hiệu trưởng') ||
        posLower.includes('giám hiệu') ||
        posLower.includes('bgh') ||
        deptNameLower.includes('giám hiệu') ||
        it.departmentId === 'bgh';

      const isVice = it.role === 'vice_principal' || posLower.includes('phó');
      const role: UserRole = isBgh ? (isVice ? 'vice_principal' : 'admin') : (it.role || 'teacher');

      newStaffObjects.push({
        uid,
        schoolId: activeSchool.id,
        email: it.email || `${prefix}.${uid}@school.edu.vn`,
        displayName: it.displayName.trim(),
        positionTitle: it.positionTitle || (isBgh ? (role === 'admin' ? 'Hiệu trưởng' : 'Phó Hiệu trưởng') : ''),
        role,
        departmentId: isBgh ? '' : (it.departmentId || 'khoi_1'),
        departmentName: isBgh ? 'Ban Giám Hiệu' : (it.departmentName || 'Tổ Khối 1'),
        status: 'active',
        phone: it.phone || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (newStaffObjects.length === 0) return;

    const updated = [...staffList, ...newStaffObjects];
    setStaffList(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_staff_custom_${activeSchool.id}`, JSON.stringify(updated));
    }
    localDb.saveStaff(updated, activeSchool.id);
  };

  const setSelectedAcademicYear = async (year: string) => {
    setSelectedAcademicYearState(year);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_academic_year_${activeSchool.id}`, year);
    }
  };

  // Process and validate authenticated Google user against authoritative staffList
  const handleProcessGoogleUser = async (firebaseUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }): Promise<{ success: boolean; error?: string }> => {
    const email = firebaseUser.email?.toLowerCase().trim();
    if (!email) {
      await firebaseSignOut(auth);
      return {
        success: false,
        error: 'Tài khoản Google không có địa chỉ email hợp lệ.',
      };
    }

    // Load latest staff list for current active school
    let currentStaff: UserProfile[] = [];
    try {
      const customKey = `school_staff_custom_${activeSchool.id}`;
      const local = typeof window !== 'undefined' ? localStorage.getItem(customKey) : null;
      if (local) {
        currentStaff = JSON.parse(local);
      }
    } catch {}
    if (currentStaff.length === 0) {
      currentStaff = staffList.length > 0 ? staffList : localDb.getStaff(activeSchool.id);
    }

    // Deleted staff filter
    let deletedUids = new Set<string>();
    try {
      const delRaw = localStorage.getItem(`school_deleted_staff_${activeSchool.id}`);
      if (delRaw) deletedUids = new Set(JSON.parse(delRaw));
    } catch {}

    const validStaff = currentStaff.filter((s) => !deletedUids.has(s.uid));

    // Match by email
    let matched = validStaff.find(
      (s) => s.email && s.email.toLowerCase().trim() === email
    );

    // Initial super admin check (mynhienbobeo@gmail.com)
    const isOwner = email === INITIAL_ADMIN_EMAIL.toLowerCase().trim();
    if (!matched && isOwner) {
      matched = validStaff.find((s) => s.uid === 'admin_mynhien') || {
        uid: 'admin_mynhien',
        email: INITIAL_ADMIN_EMAIL,
        displayName: 'Cô Trương Thị Mỹ Nhiên',
        positionTitle: 'Tổ trưởng Tổ Khối 2',
        role: 'lead',
        departmentId: 'khoi_2',
        departmentName: 'Tổ Khối 2',
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    if (!matched) {
      // User is not in "Phân quyền & Tài khoản"!
      await firebaseSignOut(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`school_active_staff_${activeSchool.id}`);
        localStorage.removeItem('school_active_staff_uid');
        localStorage.setItem('school_logged_out', 'true');
      }
      setCurrentUser(null);
      setUserProfile(null);
      return {
        success: false,
        error: `Tài khoản Google "${email}" chưa được cấp quyền trong trường "${activeSchool.name}".\n\nVui lòng liên hệ Ban Giám Hiệu (${INITIAL_ADMIN_EMAIL}) để phân quyền và thêm email này vào mục "Phân quyền & Tài khoản" trước khi đăng nhập!`,
      };
    }

    if (matched.status === 'disabled') {
      await firebaseSignOut(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`school_active_staff_${activeSchool.id}`);
        localStorage.removeItem('school_active_staff_uid');
        localStorage.setItem('school_logged_out', 'true');
      }
      setCurrentUser(null);
      setUserProfile(null);
      return {
        success: false,
        error: `Tài khoản (${email}) của bạn đang bị "Vô hiệu hóa" (Khóa tài khoản). Vui lòng liên hệ Ban Giám Hiệu để mở lại.`,
      };
    }

    // Success! Update active profile and currentUser with their exact assigned role
    const boundProfile: UserProfile = {
      ...matched,
      displayName: matched.displayName || firebaseUser.displayName || 'Thành viên',
      photoURL: firebaseUser.photoURL || matched.photoURL || undefined,
    };

    const boundAppUser: AppUser = {
      uid: matched.uid,
      email: firebaseUser.email,
      displayName: boundProfile.displayName,
      photoURL: boundProfile.photoURL || null,
      provider: 'google-firebase',
    };

    if (typeof window !== 'undefined') {
      localStorage.removeItem('school_logged_out');
      localStorage.setItem(`school_active_staff_${activeSchool.id}`, matched.uid);
      localStorage.setItem('school_active_staff_uid', matched.uid);
      localStorage.setItem(`school_user_profile_${matched.uid}`, JSON.stringify(boundProfile));
    }

    setCurrentUser(boundAppUser);
    setUserProfile(boundProfile);
    return { success: true };
  };

  // Check redirect result on load
  useEffect(() => {
    let isMounted = true;
    const checkRedirect = async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user && isMounted) {
          const processResult = await handleProcessGoogleUser(res.user);
          if (!processResult.success) {
            console.warn('Redirect auth notice:', processResult.error);
          }
        }
      } catch (err: any) {
        console.warn('Redirect auth check warning:', err);
      }
    };
    checkRedirect();
    return () => {
      isMounted = false;
    };
  }, [activeSchool.id]);

  // Auth methods
  const signInWithGoogle = async (useRedirect = false) => {
    try {
      setLoading(true);
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      let res;
      try {
        res = await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (popupErr?.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }

      if (res?.user) {
        const processResult = await handleProcessGoogleUser(res.user);
        if (!processResult.success) {
          throw new Error(processResult.error || 'Tài khoản chưa được phân quyền.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    return signInWithGoogle(true);
  };

  const signInWithSupabaseGoogle = async () => {
    const { error } = await supaSignInGoogle(window.location.origin);
    if (error) throw error;
  };

  const signInWithSupabaseEmail = async (email: string, pass: string) => {
    const { data, error } = await supaSignInEmail(email.trim(), pass);
    if (error) throw error;
    if (data.user) {
      await switchUser(data.user.email || data.user.id);
    }
  };

  const signUpWithSupabaseEmail = async (
    email: string,
    pass: string,
    displayName?: string
  ) => {
    const { data, error } = await supaSignUpEmail(email.trim(), pass, displayName);
    if (error) throw error;
    if (data.user) {
      await addNewStaffMember({
        email: data.user.email,
        displayName: displayName || email.split('@')[0],
      });
    }
  };

  const logout = async () => {
    try {
      await Promise.allSettled([firebaseSignOut(auth), signOutSupabase()]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`school_active_staff_${activeSchool.id}`);
        localStorage.removeItem('school_active_staff_uid');
        localStorage.setItem('school_logged_out', 'true');
      }
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
      if (typeof window !== 'undefined') {
        localStorage.setItem('school_logged_out', 'true');
      }
      setCurrentUser(null);
      setUserProfile(null);
    }
  };

  const updateCurrentProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = {
      ...(userProfile || {}),
      ...updates,
      updatedAt: new Date().toISOString(),
    } as UserProfile;

    setUserProfile(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`school_user_profile_${currentUser.uid}`, JSON.stringify(updated));
    }
  };

  // Helper roles
  const isAdmin = Boolean(
    userProfile?.role === 'admin' ||
    currentUser?.email?.toLowerCase().trim() ===
      INITIAL_ADMIN_EMAIL.toLowerCase().trim() ||
    userProfile?.uid?.includes('_admin')
  );
  const isVicePrincipal = Boolean(isAdmin || userProfile?.role === 'vice_principal');
  const isLead = Boolean(userProfile?.role === 'lead');
  const isTeacher = Boolean(userProfile?.role === 'teacher');
  const isApproved = true;

  return (
    <AuthContext.Provider
      value={{
        activeSchool,
        schoolList,
        switchSchool,
        createSchoolWorkspace,
        updateSchoolWorkspace,
        getSchoolShareLink,
        isSystemOwner,
        systemOwnerEmail,
        giftRequests,
        submitGiftSchoolRequest,
        approveGiftSchoolRequest,
        rejectGiftSchoolRequest,
        currentUser,
        userProfile,
        systemConfig,
        selectedAcademicYear,
        setSelectedAcademicYear,
        loading,
        isAdmin,
        isVicePrincipal,
        isLead,
        isTeacher,
        isApproved,
        staffList,
        switchUser,
        addNewStaffMember,
        updateStaffMember,
        deleteStaffMember,
        batchImportStaff,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signInWithSupabaseEmail,
        signUpWithSupabaseEmail,
        signInWithSupabaseGoogle,
        logout,
        updateCurrentProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
