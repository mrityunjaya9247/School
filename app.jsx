const { useState, useEffect } = React;

// --- Premium High-Visibility Icons ---
const IconUsers = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>;
const IconActivity = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const IconClock = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const IconAlert = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
const IconLogOut = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;
const IconCheck = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>;

// --- Premium Components ---

const KPIStatCard = ({ label, value, icon, trend, colorClass }) => (
    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-blue-50 flex items-center justify-between hover:-translate-y-1 transition-transform duration-300">
        <div>
            <p className="text-lg font-bold text-gray-500 mb-1">{label}</p>
            <div className="flex items-baseline space-x-3">
                <h3 className="text-4xl font-extrabold text-slate-800">{value}</h3>
                {trend && <span className={`text-lg font-bold ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{trend}</span>}
            </div>
        </div>
        <div className={`p-4 rounded-2xl ${colorClass}`}>
            {icon}
        </div>
    </div>
);

// --- Pages ---

const TenantLogin = ({ onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [schoolCode, setSchoolCode] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (email && password && schoolCode) {
            let role = 'teacher';
            if (email.includes('admin') || email.includes('principal')) role = 'principal';
            onLogin({ email, schoolCode, role });
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Left side - Premium Gradient Visual */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-16 text-white flex-col justify-between relative overflow-hidden">
                {/* Decorative background circles */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center">
                            <IconActivity />
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight">NurturePass</h1>
                    </div>
                    <p className="text-3xl font-light text-blue-100 leading-snug max-w-lg">
                        Every entry recorded.<br/>
                        <span className="font-semibold text-white">Every child cared for.</span>
                    </p>
                </div>

                <div className="relative z-10 space-y-8 bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
                    <div className="flex items-center space-x-6">
                        <div className="p-4 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30 text-white">
                            <IconCheck />
                        </div>
                        <div>
                            <h3 className="font-bold text-2xl text-white">Real-time Safety</h3>
                            <p className="text-blue-100 text-lg mt-1">Live campus arrival monitoring.</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-6">
                        <div className="p-4 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/30 text-white">
                            <IconAlert />
                        </div>
                        <div>
                            <h3 className="font-bold text-2xl text-white">Smart Care Prompts</h3>
                            <p className="text-blue-100 text-lg mt-1">AI-assisted student wellbeing alerts.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Login/Signup */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 p-12 border border-slate-100">
                    <h2 className="text-4xl font-extrabold text-slate-800 mb-3">
                        {isSignUp ? 'Create Workspace' : 'Welcome Back'}
                    </h2>
                    <p className="text-xl text-slate-500 mb-10 font-medium">
                        {isSignUp ? 'Setup your school tenant' : 'Sign in to your school dashboard'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-base font-bold text-slate-700 mb-2">School Code</label>
                            <input 
                                type="text" 
                                required
                                value={schoolCode}
                                onChange={(e) => setSchoolCode(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-lg font-semibold text-slate-800 outline-none transition-all"
                                placeholder="e.g. OAK-24"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-bold text-slate-700 mb-2">Email Address</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-lg font-semibold text-slate-800 outline-none transition-all"
                                placeholder="you@school.edu"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-bold text-slate-700 mb-2">Password</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-lg font-semibold text-slate-800 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button 
                            type="submit"
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xl py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-1"
                        >
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-lg font-medium text-slate-600">
                        {isSignUp ? 'Already have a workspace? ' : 'Need to register your school? '}
                        <button 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-blue-600 font-extrabold hover:text-blue-800 hover:underline transition-colors"
                        >
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PrincipalDashboard = ({ user }) => {
    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">Principal Overview</h1>
                    <p className="text-xl font-medium text-slate-500">Live safety and attendance for <span className="text-blue-600 font-bold">{user.schoolCode}</span></p>
                </div>
                <div className="mt-4 md:mt-0">
                    <button className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                        Export Today's Report
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                <KPIStatCard label="Total Present" value="1,248" trend="+2.4%" icon={<IconUsers />} colorClass="bg-blue-100 text-blue-700" />
                <KPIStatCard label="Absent Today" value="42" trend="-1.2%" icon={<IconActivity />} colorClass="bg-rose-100 text-rose-700" />
                <KPIStatCard label="Late Arrivals" value="18" trend="+5.0%" icon={<IconClock />} colorClass="bg-amber-100 text-amber-700" />
                <KPIStatCard label="Care Alerts" value="5" trend="-2" icon={<IconAlert />} colorClass="bg-orange-100 text-orange-700" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Live Campus Activity */}
                <div className="xl:col-span-2 bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-8">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-800">Live Campus Activity</h2>
                        <span className="px-4 py-2 bg-emerald-100 text-emerald-800 text-sm font-bold rounded-full flex items-center shadow-inner">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-lg shadow-emerald-500/50"></span>
                            Live Feed
                        </span>
                    </div>
                    <div className="space-y-4">
                        {[
                            { time: '08:42 AM', name: 'Sarah Jenkins', action: 'Entry', gate: 'Main Gate A', status: 'Success' },
                            { time: '08:40 AM', name: 'Tom Hardy', action: 'Entry', gate: 'North Gate B', status: 'Success' },
                            { time: '08:35 AM', name: 'Unknown RFID Tag', action: 'Scan Attempt', gate: 'Main Gate A', status: 'Exception' },
                            { time: '08:30 AM', name: 'Emily Chen', action: 'Entry', gate: 'Main Gate A', status: 'Success' },
                        ].map((event, i) => (
                            <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl hover:bg-slate-100 hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-slate-200">
                                <div className="flex items-center space-x-5">
                                    <div className={`p-4 rounded-xl shadow-sm ${event.status === 'Success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                        {event.status === 'Success' ? <IconCheck /> : <IconAlert />}
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-slate-800 mb-1">{event.name}</p>
                                        <p className="text-base font-medium text-slate-500">{event.action} at {event.gate}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold text-slate-400 bg-white px-4 py-2 rounded-xl shadow-sm">{event.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Device Health */}
                <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl shadow-2xl p-8 text-white">
                    <h2 className="text-2xl font-bold text-white mb-8 pb-4 border-b border-slate-700">Device Health</h2>
                    <div className="space-y-6">
                        <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold">Main Gate A Reader</p>
                                <p className="text-sm font-medium text-emerald-400 mt-1">Online • 99% Read Rate</p>
                            </div>
                            <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold">North Gate B Reader</p>
                                <p className="text-sm font-medium text-emerald-400 mt-1">Online • 98% Read Rate</p>
                            </div>
                            <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div className="p-5 bg-rose-900/40 border border-rose-800 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-rose-300">South Gate Reader</p>
                                <p className="text-sm font-medium text-rose-400 mt-1">Offline • 2 hrs ago</p>
                            </div>
                            <div className="w-4 h-4 bg-rose-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse"></div>
                        </div>
                    </div>
                    <button className="w-full mt-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl text-lg font-bold transition-colors">
                        Run Diagnostics
                    </button>
                </div>
            </div>
        </div>
    );
};

const TeacherDashboard = ({ user }) => {
    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">Classroom Dashboard</h1>
                    <p className="text-xl font-medium text-slate-500">Welcome back, <span className="text-blue-600 font-bold">{user.email}</span></p>
                </div>
                <div className="mt-4 md:mt-0">
                    <select className="bg-white border-2 border-blue-200 text-blue-700 px-6 py-3 rounded-2xl font-extrabold text-lg shadow-sm outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer">
                        <option>Class 10-A</option>
                        <option>Class 10-B</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Class Roster */}
                <div className="xl:col-span-2 bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-8 pb-4 border-b border-slate-100">Today's Roster</h2>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-base font-bold text-slate-400 uppercase tracking-wider border-b-2 border-slate-100">
                                    <th className="pb-4 px-4">Student Name</th>
                                    <th className="pb-4 px-4">Status</th>
                                    <th className="pb-4 px-4">Arrival Time</th>
                                    <th className="pb-4 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    { name: 'Alice Johnson', status: 'Present', time: '08:15 AM' },
                                    { name: 'Bob Smith', status: 'Late', time: '08:45 AM' },
                                    { name: 'Charlie Davis', status: 'Absent', time: '-' },
                                    { name: 'Diana Ross', status: 'Present', time: '08:12 AM' },
                                ].map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                        <td className="py-5 px-4">
                                            <p className="text-lg font-bold text-slate-800">{s.name}</p>
                                        </td>
                                        <td className="py-5 px-4">
                                            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold shadow-sm
                                                ${s.status === 'Present' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
                                                ${s.status === 'Late' ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
                                                ${s.status === 'Absent' ? 'bg-rose-100 text-rose-800 border border-rose-200' : ''}
                                            `}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="py-5 px-4 text-base font-medium text-slate-500">{s.time}</td>
                                        <td className="py-5 px-4 text-right">
                                            <button className="bg-white border-2 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all opacity-0 group-hover:opacity-100">
                                                Add Context
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Care Prompts */}
                <div className="bg-orange-50 rounded-3xl shadow-xl border border-orange-100 p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <IconAlert />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-orange-900 mb-8 flex items-center relative z-10">
                        <div className="bg-orange-500 text-white p-2 rounded-xl mr-3">
                            <IconAlert />
                        </div>
                        Action Required
                    </h2>
                    
                    <div className="space-y-5 relative z-10">
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-orange-200 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-extrabold text-xl text-slate-800">Charlie Davis</h3>
                                <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2 py-1 rounded-lg uppercase">High Priority</span>
                            </div>
                            <p className="text-base font-medium text-slate-600 mb-5">Absent for 3 consecutive days.</p>
                            <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-base font-bold shadow-md hover:shadow-lg transition-all">
                                Draft Parent Note
                            </button>
                        </div>
                        
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-amber-200 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-extrabold text-xl text-slate-800">Bob Smith</h3>
                                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-lg uppercase">Pattern</span>
                            </div>
                            <p className="text-base font-medium text-slate-600 mb-5">Late arrival 4 times this month.</p>
                            <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-base font-bold transition-all">
                                Review History
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- App Shell ---
const AppShell = ({ user, onLogout, children }) => {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
            {/* Sidebar */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                <div className="p-8">
                    <h1 className="text-3xl font-extrabold text-blue-600 tracking-tight flex items-center">
                        <div className="bg-blue-600 text-white p-1.5 rounded-lg mr-2">
                            <IconActivity />
                        </div>
                        NurturePass
                    </h1>
                </div>
                
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <a href="#" className="bg-blue-50 text-blue-700 flex items-center px-5 py-4 rounded-2xl font-bold text-lg shadow-sm border border-blue-100 transition-all">
                        <IconActivity />
                        <span className="ml-4">Dashboard</span>
                    </a>
                    <a href="#" className="text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center px-5 py-4 rounded-2xl font-bold text-lg transition-all border border-transparent">
                        <IconUsers />
                        <span className="ml-4">Directory</span>
                    </a>
                    {user.role === 'principal' && (
                        <a href="#" className="text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center px-5 py-4 rounded-2xl font-bold text-lg transition-all border border-transparent">
                            <IconAlert />
                            <span className="ml-4">Exceptions Queue</span>
                        </a>
                    )}
                </nav>
                
                <div className="p-6 m-4 bg-slate-50 rounded-3xl border border-slate-200">
                    <div className="flex items-center mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
                            {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4 overflow-hidden">
                            <p className="text-base font-extrabold text-slate-800 truncate">{user.email}</p>
                            <p className="text-sm font-bold text-slate-500 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-3 bg-white border-2 border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-colors font-bold shadow-sm">
                        <IconLogOut />
                        <span className="ml-3">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-[#F8FAFC]">
                <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 h-20 flex items-center px-10 justify-between sticky top-0 z-20">
                    <div className="flex items-center space-x-3">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider border border-slate-200">
                            {user.role === 'principal' ? 'Principal Portal' : 'Teacher Portal'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-6">
                        <div className="hidden md:flex items-center space-x-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            <span className="text-sm font-bold text-emerald-800">Systems Operational</span>
                        </div>
                    </div>
                </header>
                <main className="p-10 max-w-7xl mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

// --- Main App Component ---
const App = () => {
    const [user, setUser] = useState(null);

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        setUser(null);
    };

    if (!user) {
        return <TenantLogin onLogin={handleLogin} />;
    }

    return (
        <AppShell user={user} onLogout={handleLogout}>
            {user.role === 'principal' ? <PrincipalDashboard user={user} /> : <TeacherDashboard user={user} />}
        </AppShell>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
