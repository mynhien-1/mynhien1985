import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Department, UserProfile } from '../types';
import { localDb } from '../services/localDb';
import { DEPARTMENT_THEMES } from '../constants';
import { Users2, UserCheck, ArrowRightLeft, Shield, School, Edit2, Check, X, AlertCircle, Crown } from 'lucide-react';

interface Props {
  departments: Department[];
  users: UserProfile[];
  onRefresh: () => void;
}

export const DepartmentsView: React.FC<Props> = ({ departments, users, onRefresh }) => {
  const { isAdmin, isVicePrincipal, activeSchool } = useAuth();

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [selectedLeadUid, setSelectedLeadUid] = useState<string>('');
  const [deptDesc, setDeptDesc] = useState('');
  const [transferUser, setTransferUser] = useState<UserProfile | null>(null);
  const [targetDeptId, setTargetDeptId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to reliably check if a user is BGH
  const isUserBgh = (u: UserProfile) => {
    const posLower = (u.positionTitle || '').toLowerCase();
    const deptNameLower = (u.departmentName || '').toLowerCase();
    return (
      u.role === 'admin' ||
      u.role === 'vice_principal' ||
      posLower.includes('hiệu trưởng') ||
      posLower.includes('giám hiệu') ||
      posLower.includes('bgh') ||
      deptNameLower.includes('giám hiệu') ||
      u.departmentId === 'bgh'
    );
  };

  const bghMembers = users.filter((u) => isUserBgh(u));

  const startEditDept = (dept: Department) => {
    setEditingDept(dept);
    setSelectedLeadUid(dept.leadUid || '');
    setDeptDesc(dept.description || '');
    setError(null);
  };

  const handleSaveDept = async () => {
    if (!editingDept) return;
    setSaving(true);
    setError(null);

    try {
      const selectedLead = users.find((u) => u.uid === selectedLeadUid);
      const updatedDepartments = departments.map((d) =>
        d.id === editingDept.id
          ? {
              ...d,
              leadUid: selectedLeadUid || '',
              leadName: selectedLead?.displayName || '',
              description: deptDesc.trim(),
              updatedAt: new Date().toISOString(),
            }
          : d
      );

      localDb.saveDepartments(updatedDepartments, activeSchool?.id || 'th-ba-chuc');

      // If a new lead was selected, update their user role to 'lead' and department
      if (selectedLead && selectedLead.role !== 'admin' && selectedLead.role !== 'vice_principal') {
        const updatedUsers = users.map((u) =>
          u.uid === selectedLead.uid
            ? {
                ...u,
                role: 'lead' as const,
                departmentId: editingDept.id,
                departmentName: editingDept.name,
                updatedAt: new Date().toISOString(),
              }
            : u
        );
        localDb.saveStaff(updatedUsers, activeSchool?.id || 'th-ba-chuc');
      }

      setEditingDept(null);
      onRefresh();
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu thông tin tổ chuyên môn');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferTeacher = async () => {
    if (!transferUser || !targetDeptId) return;
    const targetDept = departments.find((d) => d.id === targetDeptId);
    if (!targetDept) return;

    setSaving(true);
    try {
      const updatedUsers = users.map((u) =>
        u.uid === transferUser.uid
          ? {
              ...u,
              departmentId: targetDept.id,
              departmentName: targetDept.name,
              updatedAt: new Date().toISOString(),
            }
          : u
      );
      localDb.saveStaff(updatedUsers, activeSchool?.id || 'th-ba-chuc');
      setTransferUser(null);
      onRefresh();
    } catch (e: any) {
      setError(e.message || 'Lỗi chuyển giáo viên');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/95 p-5 rounded-2xl border border-purple-100 shadow-2xs">
        <h2 className="text-xl font-bold text-purple-950 tracking-tight flex items-center gap-2">
          <Users2 className="w-5 h-5 text-purple-600" />
          Quản Lý Ban Giám Hiệu & 5 Tổ Khối Chuyên Môn
        </h2>
        <p className="text-xs text-purple-600/80 mt-1">
          Cơ cấu Ban Giám Hiệu và các tổ chuyên môn Khối 1 đến Khối 5. Ban Giám Hiệu chỉ hiển thị ở cột Ban Giám Hiệu độc lập, không nằm trong danh sách các tổ khối.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Columns Grid: BGH Column first, then 5 Grade Block Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CỘT DÀNH CHO BAN GIÁM HIỆU */}
        <div className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-purple-50/40 to-sky-50/50 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Crown className="w-4 h-4 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-bold text-purple-950 text-sm">Ban Giám Hiệu</h3>
                  <p className="text-[10px] font-semibold text-amber-700">Lãnh đạo & Quản lý trường học</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300 shrink-0">
                Toàn trường
              </span>
            </div>

            {/* BGH Description */}
            <div className="p-3 rounded-2xl bg-white/85 border border-amber-200/80 mb-3 shadow-2xs">
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block mb-1">
                Phân quyền lãnh đạo
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Hiệu trưởng và Phó Hiệu trưởng phụ trách quản lý toàn trường, kiểm tra & phê duyệt hồ sơ bài dạy của cả 5 khối.
              </p>
            </div>

            {/* Members in BGH */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                <span className="font-bold text-purple-950">Danh sách Ban Giám Hiệu ({bghMembers.length})</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {bghMembers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Chưa có thành viên Ban Giám Hiệu.</p>
                ) : (
                  bghMembers.map((tc) => (
                    <div
                      key={tc.uid}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 text-xs border border-amber-200 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate">{tc.displayName}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 font-bold shrink-0">
                            {tc.role === 'admin' ? 'Hiệu trưởng' : 'Phó Hiệu trưởng'}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-600 truncate block mt-0.5">{tc.email}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-amber-200/60 text-[11px] text-amber-800 font-medium flex items-center justify-between">
            <span>* Quản lý độc lập tại cột BGH</span>
            <span className="font-bold text-[10px] bg-amber-200/70 px-2 py-0.5 rounded-lg text-amber-950">Cột riêng biệt</span>
          </div>
        </div>

        {/* 5 CỘT TỔ KHỐI CHUYÊN MÔN (KHỐI 1 ĐẾN KHỐI 5) */}
        {departments.map((dept) => {
          // Strictly exclude Ban Giám Hiệu from all grade block columns
          const deptTeachers = users.filter((u) => u.departmentId === dept.id && !isUserBgh(u));
          const currentLead = users.find((u) => u.uid === dept.leadUid && !isUserBgh(u));
          const theme = DEPARTMENT_THEMES[dept.id] || DEPARTMENT_THEMES.khoi_1;

          return (
            <div
              key={dept.id}
              className={`rounded-3xl border ${theme.borderBadge} bg-gradient-to-br ${theme.cardGradient} shadow-2xs p-5 flex flex-col justify-between hover:shadow-xs transition`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-2xl ${theme.iconBg} text-white flex items-center justify-center font-bold text-xs shadow-2xs`}>
                      K{dept.gradeNumber}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{dept.name}</h3>
                      <p className={`text-[10px] font-semibold ${theme.accentColor}`}>Khối lớp {dept.gradeNumber}</p>
                    </div>
                  </div>

                  {(isAdmin || isVicePrincipal) && (
                    <button
                      onClick={() => startEditDept(dept)}
                      className="p-1.5 text-purple-400 hover:text-purple-700 hover:bg-white/80 rounded-xl transition cursor-pointer"
                      title="Phân công Tổ trưởng / Sửa mô tả"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Lead info */}
                <div className="p-3 rounded-2xl bg-white/80 border border-white/70 mb-3 shadow-2xs">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">
                    Tổ trưởng chuyên môn
                  </span>
                  {currentLead ? (
                    <div className="flex items-center gap-2 text-xs">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-purple-950">{currentLead.displayName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium italic">Chưa phân công Tổ trưởng</span>
                  )}
                </div>

                {/* Description */}
                {dept.description && (
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">{dept.description}</p>
                )}

                {/* Teachers in this block */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>Thành viên trong tổ ({deptTeachers.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {deptTeachers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Chưa có giáo viên nào trong tổ.</p>
                    ) : (
                      deptTeachers.map((tc) => (
                        <div
                          key={tc.uid}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/80 text-xs border border-white/80 shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 block truncate">{tc.displayName}</span>
                            <span className="text-[10px] text-purple-400 truncate block">{tc.email}</span>
                          </div>
                          {(isAdmin || isVicePrincipal) && (
                            <button
                              onClick={() => {
                                setTransferUser(tc);
                                setTargetDeptId(dept.id);
                              }}
                              className="text-[10px] text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 font-semibold px-2 py-1 rounded-lg shrink-0 cursor-pointer transition border border-purple-200/60"
                              title="Chuyển tổ chuyên môn"
                            >
                              Chuyển tổ
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-purple-100 space-y-4">
            <h3 className="font-bold text-purple-950 text-base">Phân công {editingDept.name}</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tổ trưởng chuyên môn (chọn từ danh sách giáo viên)
              </label>
              <select
                value={selectedLeadUid}
                onChange={(e) => setSelectedLeadUid(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-purple-200 p-2.5 text-slate-800 bg-white focus:outline-hidden focus:border-purple-400"
              >
                <option value="">-- Chưa gán Tổ trưởng --</option>
                {users
                  .filter((u) => !isUserBgh(u))
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.email}) - Hiện tại: {u.departmentName || 'Chưa phân tổ'}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả / Ghi chú tổ</label>
              <textarea
                rows={2}
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                className="w-full text-xs rounded-xl border border-purple-200 p-2.5 text-slate-800 bg-white focus:outline-hidden focus:border-purple-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-purple-50 rounded-xl font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveDept}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 hover:from-purple-600 hover:to-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-purple-200"
              >
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Teacher Modal */}
      {transferUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-purple-100 space-y-4">
            <h3 className="font-bold text-purple-950 text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              Chuyển Tổ Khối
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Chuyển giáo viên <strong className="text-purple-950">{transferUser.displayName}</strong> sang tổ chuyên môn mới:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn Tổ Khối đích</label>
              <select
                value={targetDeptId}
                onChange={(e) => setTargetDeptId(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-purple-200 p-2.5 text-slate-800 bg-white focus:outline-hidden focus:border-purple-400"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferUser(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-purple-50 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleTransferTeacher}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 hover:from-purple-600 hover:to-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-purple-200"
              >
                {saving ? 'Đang chuyển...' : 'Xác nhận chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
