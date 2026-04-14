"use client"

import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Search, Edit3, Trash2, Bell, BellOff, 
  Upload, Mic, FileText, Play, Pause, Square, 
  ChevronLeft, ChevronRight, Calendar, CheckSquare, 
  Timer, Watch, FolderOpen, Music, Sun,
  Moon, Sparkles, Zap, Target, BarChart3
} from 'lucide-react';
import { startVoiceRecognition } from '@/lib/speech';
import { extractTextFromFile, extractReminderFromText } from '@/lib/fileUpload';
import { startAlarm, cleanupAlarm } from '@/lib/clientAlarm';
import DashboardGraph from '@/app/_components/dashboard/dashboard-graph';
import PersonalizedSuggestion from "@/app/_components/dashboard/personalized_suggestion"
type UiReminder = {
  _id?: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
};

const RimixApp = () => {
  const [reminders, setReminders] = useState<UiReminder[]>([]);
  const [sleepData, setSleepData] = useState(null); 
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<UiReminder | null>(null);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    priority: 'medium',
    category: 'Personal'
  });
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [timerTime, setTimerTime] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('reminders');
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [crazyMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [hasCustomAlarm, setHasCustomAlarm] = useState(false);
  const firedIdsRef = React.useRef<Set<string>>(new Set());

  const itemsPerPage = 8;

  // Stats for dashboard
  const stats = {
    total: reminders.length,
    completed: reminders.filter(r => r.completed).length,
    pending: reminders.filter(r => !r.completed).length,
    highPriority: reminders.filter(r => r.priority === 'high' && !r.completed).length,
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/reminders');
        const data = await res.json();
        if (data?.ok) setReminders(data.data.items);
      } catch {
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [notificationsEnabled]);

  const getDueDate = (r: UiReminder) => {
    if (!r.date || !r.time) return null;
    const [hh, mm] = r.time.split(':').map((v) => parseInt(v, 10));
    const d = new Date(r.date);
    d.setHours(hh || 0, mm || 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  };

  const playChime = () => {
    if (typeof window === 'undefined') return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      o.start();
      o.stop(ctx.currentTime + 1.05);
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'square';
      o2.frequency.value = 660;
      o2.connect(g2);
      g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0.001, ctx.currentTime + 0.2);
      g2.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.22);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      o2.start(ctx.currentTime + 0.2);
      o2.stop(ctx.currentTime + 1.25);
    } catch {}
  };

  const triggerReminderEffects = React.useCallback((r: UiReminder) => {
    if (hasCustomAlarm) {
      startAlarm(() => {
        console.log('Reminder alarm dismissed by user:', r.title);
      });
    } else if (crazyMode) {
      playChime();
    }

    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200, 100, 300]); } catch {}
    }
    
    try {
      const utter = new SpeechSynthesisUtterance(`${r.title}. ${r.description || ''}`);
      utter.rate = 1.0; utter.pitch = 1.0; utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    } catch {}
    
    if (notificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('Reminder', {
            body: `${r.title}${r.time ? ` • ${r.time}` : ''}`,
            icon: '/favicon.ico'
          });
        } catch {}
      }
    }
  }, [hasCustomAlarm, crazyMode, notificationsEnabled]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        cleanupAlarm();
      }
    };
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      reminders.forEach((r) => {
        if (r.completed) return;
        const due = getDueDate(r);
        if (!due) return;
        const rid = (r._id || r.title) as string;
        
        const timeDiff = Math.abs(now.getTime() - due.getTime());
        if (timeDiff <= 5000 && !firedIdsRef.current.has(rid)) {
          firedIdsRef.current.add(rid);
          triggerReminderEffects(r);
          
          setTimeout(() => {
            firedIdsRef.current.delete(rid);
          }, 60000);
        }
      });
    };

    checkReminders();

    const intervalId = setInterval(checkReminders, 5000);

    return () => clearInterval(intervalId);
  }, [reminders, hasCustomAlarm, crazyMode, notificationsEnabled, triggerReminderEffects]);

  const filteredReminders = reminders.filter(reminder =>
    reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reminder.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredReminders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentReminders = filteredReminders.slice(startIndex, startIndex + itemsPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handle reminder creation
  const handleCreateReminder = async () => {
    try {
      if (editingReminder && editingReminder._id) {
        const res = await fetch(`/api/reminders/${editingReminder._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newReminder }),
        });
        const data = await res.json();
        if (data?.ok) {
          setReminders(reminders.map(r => r._id === data.data._id ? data.data : r));
        }
        setEditingReminder(null);
      } else {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newReminder }),
        });
        const data = await res.json();
        if (data?.ok) setReminders([data.data, ...reminders]);
      }
  } catch {
  }
    setIsModalOpen(false);
    setNewReminder({
      title: '',
      description: '',
      date: '',
      time: '',
      priority: 'medium',
      category: 'Personal'
    });
  };

  // Handle reminder deletion
  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data?.ok) setReminders(reminders.filter(reminder => reminder._id !== id));
    } catch {}
  };

  // Handle reminder toggle (complete/incomplete)
  const handleToggleReminder = async (id: string) => {
    const target = reminders.find(r => r._id === id);
    if (!target) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !target.completed })
      });
      const data = await res.json();
      if (data?.ok) setReminders(reminders.map(r => r._id === id ? data.data : r));
    } catch {}
  };

  // Handle edit reminder
  const handleEditReminder = (reminder: UiReminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      title: reminder.title || '',
      description: reminder.description || '',
      date: reminder.date || '',
      time: reminder.time || '',
      priority: reminder.priority,
      category: reminder.category
    });
    setIsModalOpen(true);
  };

  // Stopwatch effects
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (stopwatchRunning) {
      intervalId = setInterval(() => {
        setStopwatchTime(prevTime => prevTime + 10);
      }, 10);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [stopwatchRunning]);

  // Timer effects
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (timerRunning && timerTime > 0) {
      intervalId = setInterval(() => {
        setTimerTime(prevTime => prevTime - 1);
      }, 1000);
    } else if (timerTime === 0) {
      setTimerRunning(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timerRunning, timerTime]);

  const formatStopwatchTime = (time: number) => {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const milliseconds = Math.floor((time % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const formatTimerTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getWeatherIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      return <Sun className="text-yellow-400" size={24} />;
    } else {
      return <Moon className="text-indigo-400" size={24} />;
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' : 'bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-gray-800'}`}>
      {/* Header */}
      <header className={`mx-auto p-6 transition-all duration-500 ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 shadow-2xl' : 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-xl'} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl ${darkMode ? 'bg-gray-700/50 backdrop-blur-sm' : 'bg-white/20 backdrop-blur-sm'} shadow-lg`}>
              <Clock size={32} className={darkMode ? 'text-amber-400' : 'text-white'} />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Rimix</h1>
              <p className={`text-sm ${darkMode ? 'text-amber-200' : 'text-amber-100'}`}>Smart Reminders & Productivity</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-2">
              {getWeatherIcon()}
              <span className="text-white font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-2xl transition-all duration-300 shadow-lg ${
                darkMode 
                  ? 'bg-amber-500/20 text-yellow-300 hover:bg-amber-500/30' 
                  : 'bg-white/20 text-amber-700 hover:bg-white/30'
              } backdrop-blur-sm`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-orange-600 hover:bg-amber-50 font-bold py-3 px-6 rounded-2xl flex items-center space-x-3 transition-all duration-300 shadow-lg hover:scale-105 hover:shadow-xl"
            >
              <Plus size={22} />
              <span>New Reminder</span>
              <Sparkles size={16} className="text-amber-500" />
            </button>
            
            <button 
              onClick={() => setNotificationsEnabled((v) => !v)}
              className={`p-3 rounded-2xl flex items-center space-x-2 transition-all duration-300 shadow-lg backdrop-blur-sm ${
                notificationsEnabled 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : darkMode 
                    ? 'bg-gray-700/50 text-gray-200 hover:bg-gray-700' 
                    : 'bg-white/20 text-gray-700 hover:bg-white/30'
              }`}
              title="Enable desktop notifications"
            >
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`rounded-2xl p-6 shadow-lg backdrop-blur-sm transition-all duration-300 ${
            darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/80 border border-amber-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Reminders</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <Target className={darkMode ? 'text-amber-400' : 'text-amber-600'} size={24} />
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-lg backdrop-blur-sm transition-all duration-300 ${
            darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/80 border border-green-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Completed</p>
                <p className="text-3xl font-bold mt-2 text-green-500">{stats.completed}</p>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <CheckSquare className={darkMode ? 'text-green-400' : 'text-green-600'} size={24} />
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-lg backdrop-blur-sm transition-all duration-300 ${
            darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/80 border border-blue-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Pending</p>
                <p className="text-3xl font-bold mt-2 text-blue-500">{stats.pending}</p>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Clock className={darkMode ? 'text-blue-400' : 'text-blue-600'} size={24} />
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-lg backdrop-blur-sm transition-all duration-300 ${
            darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/80 border border-red-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>High Priority</p>
                <p className="text-3xl font-bold mt-2 text-red-500">{stats.highPriority}</p>
              </div>
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <Zap className={darkMode ? 'text-red-400' : 'text-red-600'} size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex mb-8 rounded-2xl overflow-hidden shadow-xl ${darkMode ? 'bg-gray-800/50 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm'} border ${darkMode ? 'border-gray-700' : 'border-amber-100'}`}>
          {[
            { id: 'reminders', label: 'Reminders', icon: Clock },
            { id: 'stopwatch', label: 'Stopwatch', icon: Watch },
            { id: 'timer', label: 'Timer', icon: Timer }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-5 font-semibold flex items-center justify-center space-x-3 transition-all duration-300 ${
                activeTab === tab.id 
                  ? (darkMode ? 'bg-amber-600 shadow-inner' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-inner') 
                  : (darkMode ? 'bg-transparent hover:bg-gray-700/50' : 'bg-transparent hover:bg-amber-50 text-amber-700')
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={22} />
              <span className="text-lg">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'reminders' && (
          <>
            {/* Dashboard summary */}
            <div className={`rounded-2xl shadow-xl p-8 mb-8 backdrop-blur-sm border ${
              darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
            }`}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                <div className="xl:col-span-2">
                  <div className="flex items-center space-x-3 mb-6">
                    <BarChart3 className={darkMode ? 'text-amber-400' : 'text-amber-600'} size={28} />
                    <h2 className="text-2xl font-bold">Productivity Analytics</h2>
                  </div>
                   <DashboardGraph 
                    reminders={reminders} 
                    onSleepDataUpdate={setSleepData}
                  />
                </div>
                <div className="xl:col-span-2">
                  <div className="flex items-center space-x-3 mb-6">
                    <Sparkles className={darkMode ? 'text-amber-400' : 'text-amber-600'} size={28} />
                    <h2 className="text-2xl font-bold">Smart Suggestions</h2>
                  </div>
                 <PersonalizedSuggestion 
                  sleepData={sleepData} 
                  reminders={reminders} 
                    />
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className={`rounded-2xl shadow-lg p-6 mb-8 flex items-center backdrop-blur-sm border ${
              darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
            }`}>
              <Search className={`mr-4 ${darkMode ? 'text-gray-400' : 'text-amber-500'}`} size={24} />
              <input
                type="text"
                placeholder="Search reminders by task or description..."
                className={`w-full p-3 outline-none text-lg bg-transparent placeholder-${
                  darkMode ? 'gray-500' : 'amber-400'
                }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Reminders List */}
            <div className={`rounded-2xl shadow-xl overflow-hidden mb-8 backdrop-blur-sm border ${
              darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
            }`}>
              {currentReminders.length > 0 ? (
                currentReminders.map(reminder => (
                  <div 
                    key={reminder._id || reminder.title} 
                    className={`border-b p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${
                      darkMode 
                        ? `border-gray-700 hover:bg-gray-700/50 ${reminder.completed ? 'bg-gray-700/30' : ''}`
                        : `border-amber-100 hover:bg-amber-50/50 ${reminder.completed ? 'bg-amber-50/70' : ''}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-5">
                        <button 
                          onClick={() => handleToggleReminder(reminder._id as string)}
                          className={`p-3 rounded-2xl transition-all duration-300 ${
                            reminder.completed 
                              ? (darkMode ? 'bg-green-600/30 text-green-400' : 'bg-green-100 text-green-600') 
                              : (darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-amber-100 hover:bg-amber-200 text-amber-600')
                          }`}
                        >
                          {reminder.completed ? <CheckSquare size={22} /> : <Square size={22} />}
                        </button>
                        <div className="flex-1">
                          <h3 className={`text-xl font-semibold mb-2 ${reminder.completed ? 'line-through opacity-70' : ''}`}>
                            {reminder.title}
                          </h3>
                          {reminder.description && (
                            <p className={`text-lg mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {reminder.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 flex-wrap gap-2">
                            {reminder.date && (
                              <span className={`text-sm flex items-center px-3 py-1 rounded-full ${
                                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-amber-100 text-amber-700'
                              }`}>
                                <Calendar size={14} className="mr-2" />
                                {reminder.date}
                              </span>
                            )}
                            {reminder.time && (
                              <span className={`text-sm flex items-center px-3 py-1 rounded-full ${
                                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-amber-100 text-amber-700'
                              }`}>
                                <Clock size={14} className="mr-2" />
                                {reminder.time}
                              </span>
                            )}
                            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                              reminder.priority === 'high' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              reminder.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              'bg-green-500/20 text-green-300 border border-green-500/30'
                            }`}>
                              {reminder.priority}
                            </span>
                            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                              darkMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {reminder.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditReminder(reminder)}
                          className={`p-3 rounded-2xl transition-all duration-300 ${
                            darkMode 
                              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          <Edit3 size={20} />
                        </button>
                        <button 
                          onClick={() => handleDeleteReminder(reminder._id as string)}
                          className={`p-3 rounded-2xl transition-all duration-300 ${
                            darkMode 
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <FolderOpen size={64} className="mx-auto mb-4 text-amber-400 opacity-50" />
                  <p className="text-xl text-gray-500 mb-2">No reminders found</p>
                  <p className="text-gray-400">Create your first reminder to get started!</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-6 mb-8">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`p-4 rounded-2xl shadow-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <ChevronLeft size={24} />
                </button>
                <span className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-amber-700'}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`p-4 rounded-2xl shadow-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Stopwatch Tab */}
        {activeTab === 'stopwatch' && (
          <div className={`rounded-2xl shadow-xl p-12 text-center mb-8 backdrop-blur-sm border ${
            darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
          }`}>
            <h2 className="text-3xl font-bold mb-8 flex items-center justify-center">
              <Watch className="mr-3 text-amber-500" size={32} />
              Stopwatch
            </h2>
            <div className={`text-7xl font-mono font-bold mb-12 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              {formatStopwatchTime(stopwatchTime)}
            </div>
            <div className="flex justify-center space-x-6">
              {!stopwatchRunning ? (
                <button 
                  onClick={() => setStopwatchRunning(true)}
                  className="bg-green-500 hover:bg-green-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Play size={24} />
                  <span className="text-lg">Start</span>
                </button>
              ) : (
                <button 
                  onClick={() => setStopwatchRunning(false)}
                  className="bg-red-500 hover:bg-red-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Pause size={24} />
                  <span className="text-lg">Pause</span>
                </button>
              )}
              <button 
                onClick={() => {
                  setStopwatchRunning(false);
                  setStopwatchTime(0);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
              >
                <Square size={24} />
                <span className="text-lg">Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* Timer Tab */}
        {activeTab === 'timer' && (
          <div className={`rounded-2xl shadow-xl p-12 text-center mb-8 backdrop-blur-sm border ${
            darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
          }`}>
            <h2 className="text-3xl font-bold mb-8 flex items-center justify-center">
              <Timer className="mr-3 text-amber-500" size={32} />
              Timer
            </h2>
            <div className={`text-7xl font-mono font-bold mb-12 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              {formatTimerTime(timerTime)}
            </div>
            <div className="mb-8">
              <label className={`block mb-4 text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Set Timer (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={Math.floor(timerTime / 60)}
                onChange={(e) => setTimerTime(parseInt(e.target.value) * 60)}
                className={`border-2 rounded-2xl p-4 text-center text-xl w-40 font-bold ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-amber-300 text-amber-700'
                }`}
                disabled={timerRunning}
              />
            </div>
            <div className="flex justify-center space-x-6">
              {!timerRunning ? (
                <button 
                  onClick={() => setTimerRunning(true)}
                  className="bg-green-500 hover:bg-green-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Play size={24} />
                  <span className="text-lg">Start</span>
                </button>
              ) : (
                <button 
                  onClick={() => setTimerRunning(false)}
                  className="bg-red-500 hover:bg-red-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <Pause size={24} />
                  <span className="text-lg">Pause</span>
                </button>
              )}
              <button 
                onClick={() => {
                  setTimerRunning(false);
                  setTimerTime(300);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white py-4 px-8 rounded-2xl flex items-center space-x-3 shadow-lg hover:scale-105 transition-all duration-300"
              >
                <Square size={24} />
                <span className="text-lg">Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        <div className={`rounded-2xl shadow-xl p-8 mb-8 backdrop-blur-sm border ${
          darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-amber-100'
        }`}>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Upload className="mr-3 text-amber-500" size={28} />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={async () => {
                try {
                  setIsRecording(true);
                  const reminderData = await startVoiceRecognition();
                  if (reminderData.title) {
                    setNewReminder({
                      title: reminderData.title,
                      description: reminderData.description || '',
                      date: reminderData.date || '',
                      time: reminderData.time || '',
                      priority: reminderData.priority || 'medium',
                      category: reminderData.category || 'Personal'
                    });
                    setIsModalOpen(true);
                  }
                } catch (error) {
                  alert('Failed to record voice: ' + error);
                } finally {
                  setIsRecording(false);
                }
              }}
              className={`border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
                isRecording 
                  ? 'border-red-500 bg-red-50 scale-105' 
                  : darkMode 
                    ? 'border-amber-500 hover:bg-amber-500/10 hover:scale-105' 
                    : 'border-amber-400 hover:bg-amber-50 hover:scale-105'
              }`}
            >
              <div className={`p-4 rounded-2xl inline-block mb-4 ${
                isRecording 
                  ? 'bg-red-100 text-red-500 animate-pulse' 
                  : darkMode 
                    ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30' 
                    : 'bg-amber-100 text-amber-500 group-hover:bg-amber-200'
              }`}>
                <Mic size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{isRecording ? 'Listening...' : 'Voice Reminder'}</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {isRecording ? 'Speak now...' : 'Create reminder with voice'}
              </p>
            </div>

            <div
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.txt,.doc,.docx,.pdf';
                
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;

                  try {
                    const text = await extractTextFromFile(file);
                    const reminderData = extractReminderFromText(text);
                    
                    setNewReminder({
                      title: reminderData.title || file.name,
                      description: reminderData.description || '',
                      date: reminderData.date || '',
                      time: reminderData.time || '',
                      priority: reminderData.priority || 'medium',
                      category: reminderData.category || 'Personal'
                    });
                    setIsModalOpen(true);
                  } catch (error) {
                    alert('Failed to process document: ' + error);
                  }
                };

                input.click();
              }}
              className={`border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
                darkMode 
                  ? 'border-amber-500 hover:bg-amber-500/10 hover:scale-105' 
                  : 'border-amber-400 hover:bg-amber-50 hover:scale-105'
              }`}
            >
              <div className={`p-4 rounded-2xl inline-block mb-4 ${
                darkMode 
                  ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30' 
                  : 'bg-amber-100 text-amber-500 group-hover:bg-amber-200'
              }`}>
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Document Import</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Extract reminders from files
              </p>
            </div>

            <div
              onClick={() => {
                if (typeof window === 'undefined') return;
                setHasCustomAlarm(true);
                startAlarm(() => {
                  console.log('Alarm dismissed by user');
                });
              }}
              className={`border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
                hasCustomAlarm
                  ? 'border-green-500 bg-green-50 scale-105'
                  : darkMode
                    ? 'border-amber-500 hover:bg-amber-500/10 hover:scale-105'
                    : 'border-amber-400 hover:bg-amber-50 hover:scale-105'
              }`}
            >
              <div className={`p-4 rounded-2xl inline-block mb-4 ${
                hasCustomAlarm
                  ? 'bg-green-100 text-green-500'
                  : darkMode
                    ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30'
                    : 'bg-amber-100 text-amber-500 group-hover:bg-amber-200'
              }`}>
                <Music size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {hasCustomAlarm ? 'Alarm Active' : 'Custom Alarm'}
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {hasCustomAlarm ? 'Alarm is ready!' : 'Set custom alarm sound'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Create/Edit Reminder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className={`w-full max-w-4xl h-[90vh] flex flex-col md:flex-row rounded-3xl shadow-2xl overflow-hidden transform animate-scale-in ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div
              className={`md:w-1/2 p-8 flex flex-col justify-center items-center text-center ${
                darkMode
                  ? 'bg-gradient-to-b from-amber-700 to-orange-600 text-white'
                  : 'bg-gradient-to-b from-amber-400 to-orange-500 text-white'
              }`}
            >
              <h2 className="text-3xl font-bold mb-4">
                {editingReminder ? 'Edit Reminder' : 'Create Reminder'}
              </h2>
              <p className="text-lg opacity-90 mb-8">
                {editingReminder
                  ? 'Refine your goals and keep your plans up to date.'
                  : 'Organize your day, set your priorities, and never miss what matters.'}
              </p>

              <div className="w-40 h-40 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-6xl">🧠</span>
              </div>
            </div>

            <div className="md:w-1/2 h-full overflow-y-auto p-8">
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label
                    className={`block mb-3 text-lg font-medium ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Title *
                  </label>
                  <input
                    type="text"
                    className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                      darkMode
                        ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                        : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                    }`}
                    value={newReminder.title}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, title: e.target.value })
                    }
                    placeholder="Enter reminder title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    className={`block mb-3 text-lg font-medium ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Description
                  </label>
                  <textarea
                    className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                      darkMode
                        ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                        : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                    }`}
                    rows={4}
                    value={newReminder.description}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, description: e.target.value })
                    }
                    placeholder="Add details about your reminder"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label
                      className={`block mb-3 text-lg font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Date
                    </label>
                    <input
                      type="date"
                      className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                        darkMode
                          ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                          : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                      }`}
                      value={newReminder.date}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className={`block mb-3 text-lg font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Time
                    </label>
                    <input
                      type="time"
                      className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                        darkMode
                          ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                          : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                      }`}
                      value={newReminder.time}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, time: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Priority & Category */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label
                      className={`block mb-3 text-lg font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Priority
                    </label>
                    <select
                      className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                        darkMode
                          ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                          : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                      }`}
                      value={newReminder.priority}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, priority: e.target.value })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block mb-3 text-lg font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Category
                    </label>
                    <select
                      className={`w-full p-4 rounded-2xl text-lg border-2 transition-all duration-300 ${
                        darkMode
                          ? 'bg-gray-700 text-white border-gray-600 focus:border-amber-500'
                          : 'bg-amber-50 border-amber-200 focus:border-amber-500'
                      }`}
                      value={newReminder.category}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, category: e.target.value })
                      }
                    >
                      <option value="Work">Work</option>
                      <option value="Personal">Personal</option>
                      <option value="Health">Health</option>
                      <option value="Finance">Finance</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingReminder(null);
                      setNewReminder({
                        title: '',
                        description: '',
                        date: '',
                        time: '',
                        priority: 'medium',
                        category: 'Personal',
                      });
                    }}
                    className={`px-6 py-3 rounded-2xl text-lg font-medium transition-all duration-300 ${
                      darkMode
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateReminder}
                    className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-lg font-medium hover:bg-amber-600 shadow-lg hover:scale-105 transition-all duration-300"
                  >
                    {editingReminder ? 'Update Reminder' : 'Create Reminder'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Footer */}
      <footer className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        <div className="max-w-7xl mx-auto px-6">
        </div>
      </footer>
    </div>
  );
};

export default RimixApp;