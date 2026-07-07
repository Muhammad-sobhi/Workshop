'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { useAppStore } from '@/lib/store';
import apiClient from '@/lib/api-client';
import { Settings as SettingsIcon, Users, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import GeneralSettings from '@/components/settings/general-settings';
import UserTable from '@/components/settings/user-table';
import UserModal from '@/components/settings/user-modal';
import AlertDialog from '@/components/AlertDialog';

export default function SettingsPage() {
  const { user: currentUser, settings: storeSettings, updateSettingsState } = useAppStore();
  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState('general');
  
  // General Settings State
  const [companyName, setCompanyName] = useState(storeSettings.company_name);
  const [currency, setCurrency] = useState(storeSettings.currency);
  const [taxRate, setTaxRate] = useState(storeSettings.tax_rate);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // Users State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // User Form State
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userPerms, setUserPerms] = useState([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [alertDialog, setAlertDialog] = useState(null);
  
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // Permission Options (defined in UserModal component)

  useEffect(() => {
    // Load current settings values
    setCompanyName(storeSettings.company_name);
    setCurrency(storeSettings.currency);
    setTaxRate(storeSettings.tax_rate);

    if (isAdmin) {
      fetchUsers();
    }
  }, [storeSettings, isAdmin]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    setGlobalError('');
    setGlobalSuccess('');

    try {
      await apiClient.post('/settings', {
        company_name: companyName,
        currency: currency,
        tax_rate: taxRate,
      });
      updateSettingsState({
        company_name: companyName,
        currency: currency,
        tax_rate: Number(taxRate),
      });
      setGlobalSuccess('تم حفظ إعدادات النظام بنجاح.');
    } catch (err) {
      console.error(err);
      setGlobalError('فشل حفظ الإعدادات. يرجى التحقق من المدخلات.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('user');
    setUserPerms([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword('');
    setUserRole(user.role);
    setUserPerms(user.permissions || []);
    setFormError('');
    setModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    const payload = {
      name: userName,
      email: userEmail,
      role: userRole,
      permissions: userPerms,
      ...(userPassword ? { password: userPassword } : {})
    };

    try {
      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, payload);
        setGlobalSuccess('تم تحديث المستخدم بنجاح.');
      } else {
        if (!userPassword) {
          setFormError('كلمة المرور مطلوبة للمستخدمين الجدد.');
          setFormLoading(false);
          return;
        }
        await apiClient.post('/users', payload);
        setGlobalSuccess('تم إنشاء حساب مستخدم جديد بنجاح.');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setFormError(
        err.response?.data?.message || 
        err.response?.data?.errors?.email?.[0] || 
        'حدث خطأ أثناء حفظ المستخدم.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    setAlertDialog({
      type: 'confirm',
      message: 'هل أنت متأكد من رغبتك في حذف هذا المستخدم؟',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/users/${id}`);
          setGlobalSuccess('تم حذف المستخدم بنجاح.');
          fetchUsers();
        } catch (err) {
          console.error(err);
          setGlobalError(err.response?.data?.message || 'فشل حذف المستخدم.');
        }
      }
    });
  };

  const togglePermission = (permKey) => {
    if (userPerms.includes(permKey)) {
      setUserPerms(userPerms.filter(k => k !== permKey));
    } else {
      setUserPerms([...userPerms, permKey]);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">إعدادات النظام</h1>
            <p className="text-sm mt-1" style={{ color: '#A49EC0' }}>
              التحكم في خيارات العملة، الضرائب، وإدارة صلاحيات المستخدمين والعمال
            </p>
          </div>
          {isAdmin && activeTab === 'users' && (
            <button
              onClick={openCreateModal}
              className="rounded-xl py-2.5 px-4 text-xs font-bold shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 hover:opacity-90 self-start"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              <Plus className="w-4.5 h-4.5" />
              <span>إضافة مستخدم جديد</span>
            </button>
          )}
        </div>

        {/* Global Feedback */}
        {globalError && (
          <div 
            className="flex items-center gap-2 p-4 rounded-xl border text-xs text-red-200"
            style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{globalError}</span>
          </div>
        )}

        {globalSuccess && (
          <div 
            className="flex items-center gap-2 p-4 rounded-xl border text-xs text-green-200 animate-pulse"
            style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            <span>{globalSuccess}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[#3D3554] pb-px">
          <button
            onClick={() => setActiveTab('general')}
            className="px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2"
            style={activeTab === 'general' 
              ? { borderColor: '#ECC796', color: '#ECC796' }
              : { borderColor: 'transparent', color: '#A49EC0' }
            }
          >
            <SettingsIcon className="w-4 h-4" />
            <span>الإعدادات العامة</span>
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className="px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2"
              style={activeTab === 'users' 
                ? { borderColor: '#ECC796', color: '#ECC796' }
                : { borderColor: 'transparent', color: '#A49EC0' }
              }
            >
              <Users className="w-4 h-4" />
              <span>المستخدمين والصلاحيات</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'general' ? (
          <GeneralSettings
            companyName={companyName}
            setCompanyName={setCompanyName}
            currency={currency}
            setCurrency={setCurrency}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            settingsLoading={settingsLoading}
            handleSaveSettings={handleSaveSettings}
          />
        ) : (
          usersLoading ? (
            <div className="text-center py-16 text-xs" style={{ color: '#A49EC0' }}>جاري تحميل الحسابات...</div>
          ) : (
            <UserTable
              users={users}
              currentUser={currentUser}
              onEdit={openEditModal}
              onDelete={handleDeleteUser}
            />
          )
        )}
      </div>

      {modalOpen && (
        <UserModal
          editingUser={editingUser}
          userName={userName}
          setUserName={setUserName}
          userEmail={userEmail}
          setUserEmail={setUserEmail}
          userPassword={userPassword}
          setUserPassword={setUserPassword}
          userRole={userRole}
          setUserRole={setUserRole}
          userPerms={userPerms}
          togglePermission={togglePermission}
          formLoading={formLoading}
          formError={formError}
          handleUserSubmit={handleUserSubmit}
          onClose={() => setModalOpen(false)}
        />
      )}

      <AlertDialog alertDialog={alertDialog} onClose={() => setAlertDialog(null)} />
    </MainLayout>
  );
}
