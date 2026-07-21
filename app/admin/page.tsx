"use client";
// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react';

const SUPABASE_URL = 'https://msomstkrkwwfmdgnqhru.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nbXhy4goG8kX4Mgwrl60pA_VJRc8OBC';
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

export default function AdminDashboard() {
  // 🔒 نظام الحماية وتسجيل الدخول
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState(false);

  // حالات لوحة التحكم (الدشيبورد)
  const [activeMenu, setActiveMenu] = useState('overview'); 
  const [allParticipants, setAllParticipants] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [stats, setStats] = useState({ activeQuestions: 0, remainingInBank: 0 });
  const [settings, setSettings] = useState({ current_week: 1, start_day: 'Saturday', start_time: '00:00', end_day: 'Thursday', end_time: '23:59' });
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('weekly'); 
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // لا نجلب البيانات إلا بعد تسجيل الدخول بنجاح
  useEffect(() => { 
    if (isAuthenticated) {
      fetchAdminData(); 
      const interval = setInterval(fetchAdminData, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: any) => {
    e.preventDefault();
    if (loginUser === 'top' && loginPass === 'Tt112233') {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setLoginPass(''); // مسح الباسورد الخاطئ
    }
  };

  const fetchAdminData = async () => {
    try {
      const partRes = await fetch(`${SUPABASE_URL}/rest/v1/participants?select=*`, { headers, cache: 'no-store' });
      const bannedRes = await fetch(`${SUPABASE_URL}/rest/v1/banned_users?select=*`, { headers, cache: 'no-store' });
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_settings?id=eq.1&select=*`, { headers, cache: 'no-store' });
      const activeQRes = await fetch(`${SUPABASE_URL}/rest/v1/questions?is_active=eq.true&select=id`, { headers, cache: 'no-store' });
      const bankQRes = await fetch(`${SUPABASE_URL}/rest/v1/questions?is_used=eq.false&is_active=eq.false&select=id`, { headers, cache: 'no-store' });

      setAllParticipants(await partRes.json());
      setBannedUsers(await bannedRes.json());
      const setData = await setRes.json();
      if (setData.length > 0) { setSettings(setData[0]); setSelectedWeek(setData[0].current_week); }
      setStats({ activeQuestions: (await activeQRes.json()).length, remainingInBank: (await bankQRes.json()).length });
      
      setIsLoading(false);
    } catch (error) { setIsLoading(false); }
  };

  const uniquePlayers = useMemo(() => {
    const players = {};
    allParticipants.forEach(p => {
      if (!players[p.jaco_id]) players[p.jaco_id] = { id: p.jaco_id, name: p.jaco_username, total_score: 0, matches: 0 };
      players[p.jaco_id].total_score += p.score;
      players[p.jaco_id].matches += 1;
    });
    return Object.values(players);
  }, [allParticipants]);

  const weeklyLeaderboard = useMemo(() => {
    return allParticipants.filter(p => p.week_number === selectedWeek).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.total_time_ms || 99999) - (b.total_time_ms || 99999);
    });
  }, [allParticipants, selectedWeek]);

  const globalLeaderboard = useMemo(() => {
    const userScores = {};
    allParticipants.forEach(p => {
      if (!userScores[p.jaco_id]) userScores[p.jaco_id] = { jaco_username: p.jaco_username, jaco_id: p.jaco_id, total_score: 0, total_time: 0, weeks_played: 0 };
      userScores[p.jaco_id].total_score += p.score;
      userScores[p.jaco_id].total_time += (p.total_time_ms || 0);
      userScores[p.jaco_id].weeks_played += 1;
    });
    return Object.values(userScores).sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.total_time - b.total_time;
    });
  }, [allParticipants]);

  const handleBanUser = async (user) => {
    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من حظر [${user.name}] بشكل نهائي؟`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/banned_users`, { method: 'POST', headers, body: JSON.stringify({ jaco_id: user.id, jaco_username: user.name }) });
      fetchAdminData();
    } catch (e) {}
  };

  const handleUnbanUser = async (jacoId) => {
    if (!window.confirm("هل تريد فك الحظر عن هذا اللاعب؟")) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/banned_users?jaco_id=eq.${jacoId}`, { method: 'DELETE', headers });
      fetchAdminData();
    } catch (e) {}
  };

  const saveSettings = async (e: any) => {
    e.preventDefault(); setIsSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/tournament_settings?id=eq.1`, { method: 'PATCH', headers, body: JSON.stringify({ start_day: settings.start_day, start_time: settings.start_time, end_day: settings.end_day, end_time: settings.end_time }) });
      alert("✅ تم حفظ الأوقات بنجاح");
    } catch (error) {}
    setIsSaving(false);
  };

  const handleStartNewWeek = async () => {
    if (!window.confirm("⚠️ سيتم إغلاق الأسبوع وبدء أسبوع جديد. هل أنت متأكد؟")) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_new_week`, { method: 'POST', headers });
      alert("✅ تم بدء أسبوع جديد بنجاح!");
      fetchAdminData();
    } catch (error) {}
  };

  // --------------------------------------------------------
  // 1️⃣ شاشة تسجيل الدخول (تظهر إذا لم يتم تسجيل الدخول)
  // --------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-600/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-2xl w-[90%] max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <span className="text-3xl">🦅</span>
            </div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600">
              TOP PRO
            </h1>
            <p className="text-gray-500 text-sm mt-1">بوابة الإدارة المركزية (Admin Terminal)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs text-gray-400 block mb-1">اسم المستخدم</label>
              <input 
                type="text" 
                required 
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full bg-[#111] border border-gray-800 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 transition" 
                placeholder="أدخل اسم المستخدم"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">كلمة المرور</label>
              <input 
                type="password" 
                required 
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full bg-[#111] border border-gray-800 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 transition" 
                placeholder="••••••••"
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm font-bold text-center animate-pulse">❌ بيانات الدخول غير صحيحة!</p>
            )}

            <button type="submit" className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black text-lg p-3 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] mt-6 transition-all">
              تسجيل الدخول 🔒
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // 2️⃣ شاشة التحميل (تظهر بعد الدخول أثناء جلب البيانات)
  // --------------------------------------------------------
  if (isLoading) return <div className="min-h-screen bg-[#0a0a0a] text-yellow-500 flex items-center justify-center font-bold text-2xl animate-pulse">جاري تهيئة نظام TOP... 👑</div>;

  // --------------------------------------------------------
  // 3️⃣ لوحة التحكم الرئيسية (تظهر بعد جلب البيانات)
  // --------------------------------------------------------
  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden" dir="rtl">
      
      {/* القائمة الجانبية (Sidebar) */}
      <aside className="w-64 bg-[#0a0a0a] border-l border-white/5 flex flex-col relative z-20 shadow-[20px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600 drop-shadow-lg">TOP PRO</h1>
          <p className="text-gray-500 text-xs font-bold mt-1 tracking-widest uppercase">Admin Terminal</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: 'overview', icon: '📊', label: 'نظرة عامة' },
            { id: 'leaderboard', icon: '🏆', label: 'لوحات الصدارة' },
            { id: 'players', icon: '👥', label: 'إدارة اللاعبين' },
            { id: 'settings', icon: '⚙️', label: 'الإعدادات والجدولة' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 font-bold ${
                activeMenu === item.id ? 'bg-gradient-to-l from-yellow-600/20 to-transparent border-r-4 border-yellow-500 text-yellow-500' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <span className="text-xl">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-6 border-t border-white/5">
          <button onClick={() => setIsAuthenticated(false)} className="w-full bg-red-900/20 text-red-400 hover:bg-red-900/40 py-2 rounded-lg text-sm font-bold transition">
            تسجيل الخروج 🚪
          </button>
        </div>
      </aside>

      {/* منطقة المحتوى الرئيسية */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <div className="absolute top-0 right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="p-8 md:p-12 relative z-10 max-w-6xl mx-auto">
          {/* محتويات الأقسام (نظرة عامة، الصدارة، إدارة اللاعبين، الإعدادات) تم اختصار عرضها هنا حفاظاً على المساحة، لكنها تعمل بشكل كامل */}
          
          {activeMenu === 'overview' && (
            <div className="animate-fade-in">
              <header className="mb-10"><h2 className="text-3xl font-bold text-white">لوحة القيادة</h2></header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl"><p className="text-gray-400 font-bold mb-2">إجمالي اللاعبين المسجلين</p><h3 className="text-5xl font-black">{uniquePlayers.length}</h3></div>
                <div className="bg-white/5 border border-green-500/20 p-8 rounded-3xl"><p className="text-green-400/80 font-bold mb-2">أسئلة البطولة (النشطة)</p><h3 className="text-5xl font-black text-green-400">{stats.activeQuestions}</h3></div>
                <div className="bg-white/5 border border-blue-500/20 p-8 rounded-3xl"><p className="text-blue-400/80 font-bold mb-2">رصيد بنك الأسئلة</p><h3 className="text-5xl font-black text-blue-400">{stats.remainingInBank}</h3></div>
              </div>
            </div>
          )}

          {activeMenu === 'leaderboard' && (
            <div className="animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white">لوحة الصدارة</h2>
                <div className="flex bg-[#111] p-1 rounded-xl border border-white/5">
                  <button onClick={() => setActiveTab('weekly')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'weekly' ? 'bg-yellow-600 text-black' : 'text-gray-400 hover:text-white'}`}>الأسبوعية</button>
                  <button onClick={() => setActiveTab('global')} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'global' ? 'bg-yellow-600 text-black' : 'text-gray-400 hover:text-white'}`}>العامة (التراكمية)</button>
                </div>
              </div>
              <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                {activeTab === 'weekly' && (
                  <div className="flex justify-end mb-6">
                    <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded-xl border border-gray-800">
                      <span className="text-sm text-gray-400">تصفية الأسبوع:</span>
                      <select value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="bg-transparent text-yellow-500 font-bold outline-none cursor-pointer">
                        {Array.from({ length: settings.current_week }, (_, i) => i + 1).map(w => <option key={w} value={w} className="bg-gray-900">الأسبوع {w}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex text-gray-500 text-xs uppercase tracking-wider font-bold px-6 pb-3 border-b border-white/5">
                    <div className="w-16 text-center">المركز</div><div className="flex-1">اللاعب</div><div className="w-32 text-center">{activeTab === 'global' ? 'المشاركات' : 'رقم ID'}</div><div className="w-24 text-center">الزمن الكلي</div><div className="w-24 text-center">النقاط</div>
                  </div>
                  {(activeTab === 'weekly' ? weeklyLeaderboard : globalLeaderboard).length === 0 ? <div className="text-center py-20 text-gray-600 font-bold">لا توجد بيانات</div> : (activeTab === 'weekly' ? weeklyLeaderboard : globalLeaderboard).map((user, index) => (
                      <div key={user.jaco_id + index} className={`flex items-center px-6 py-4 rounded-2xl border transition-all duration-300 hover:bg-white/5 ${index === 0 ? 'bg-gradient-to-l from-yellow-900/20 to-transparent border-yellow-500/50' : 'bg-transparent border-transparent'}`}>
                        <div className="w-16 flex justify-center text-2xl font-black">{index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : <span className="text-gray-500 text-lg">{index + 1}</span>}</div>
                        <div className={`flex-1 font-bold text-lg ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>{user.jaco_username}</div>
                        <div className="w-32 text-center text-gray-400 text-sm font-mono">{activeTab === 'global' ? `${user.weeks_played} أسابيع` : user.jaco_id}</div>
                        <div className="w-24 text-center text-gray-400 font-mono text-sm">{activeTab === 'global' ? `${user.total_time} ث` : (user.total_time_ms ? `${user.total_time_ms} ث` : '--')}</div>
                        <div className="w-24 text-center font-black text-xl text-green-400">{activeTab === 'global' ? user.total_score : `${user.score}/10`}</div>
                      </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'players' && (
            <div className="animate-fade-in">
              <h2 className="text-3xl font-bold text-white mb-8">إدارة اللاعبين 👥</h2>
              <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {uniquePlayers.map(user => {
                    const isBanned = bannedUsers.some(b => b.jaco_id === user.id);
                    return (
                      <div key={user.id} className={`flex justify-between items-center p-4 rounded-xl border ${isBanned ? 'bg-red-900/10 border-red-900/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                        <div>
                          <p className={`font-bold text-lg ${isBanned ? 'text-red-400 line-through' : 'text-white'}`}>{user.name}</p>
                          <p className="text-gray-500 text-xs font-mono">ID: {user.id} | النقاط الكلية: {user.total_score}</p>
                        </div>
                        {isBanned ? <button onClick={() => handleUnbanUser(user.id)} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold">فك الحظر</button> : <button onClick={() => handleBanUser(user)} className="bg-red-900/40 text-red-100 px-4 py-2 rounded-lg text-sm font-bold border border-red-800">حظر نهائي 🚫</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'settings' && (
            <div className="animate-fade-in max-w-3xl">
              <h2 className="text-3xl font-bold text-white mb-8">الجدولة وإعدادات النظام ⚙️</h2>
              <form onSubmit={saveSettings} className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl mb-8">
                <div className="grid grid-cols-2 gap-8 mb-6">
                  <div className="space-y-4">
                    <h4 className="text-white font-bold">🟢 موعد الفتح</h4>
                    <div><label className="text-xs text-gray-500 block">اليوم</label><select value={settings.start_day} onChange={e=>setSettings({...settings, start_day: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-3 rounded-xl text-white"><option value="Saturday">السبت</option><option value="Sunday">الأحد</option></select></div>
                    <div><label className="text-xs text-gray-500 block">الساعة</label><input type="time" value={settings.start_time} onChange={e=>setSettings({...settings, start_time: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-3 rounded-xl text-white" /></div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-white font-bold">🔴 موعد الإغلاق</h4>
                    <div><label className="text-xs text-gray-500 block">اليوم</label><select value={settings.end_day} onChange={e=>setSettings({...settings, end_day: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-3 rounded-xl text-white"><option value="Thursday">الخميس</option><option value="Friday">الجمعة</option></select></div>
                    <div><label className="text-xs text-gray-500 block">الساعة</label><input type="time" value={settings.end_time} onChange={e=>setSettings({...settings, end_time: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-3 rounded-xl text-white" /></div>
                  </div>
                </div>
                <button type="submit" disabled={isSaving} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black py-4 rounded-xl">{isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات 💾'}</button>
              </form>
              <div className="bg-red-900/10 border border-red-900/30 p-8 rounded-3xl">
                <h3 className="text-2xl font-bold text-red-500 mb-2">منطقة الخطر ⚠️</h3>
                <button onClick={handleStartNewWeek} className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-4 rounded-xl mt-4">إغلاق الأسبوع وبدء أسبوع جديد 🚀</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(234,179,8,0.5); }`}} />
    </div>
  );
}
