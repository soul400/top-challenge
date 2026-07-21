"use client";
// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://msomstkrkwwfmdgnqhru.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nbXhy4goG8kX4Mgwrl60pA_VJRc8OBC';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

export default function TopChallenge() {
  const [step, setStep] = useState('login'); 
  const [username, setUsername] = useState('');
  const [jacoId, setJacoId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // حساب الوقت الكلي للمتسابق لكسر التعادل
  const [startTime, setStartTime] = useState(null);

  // جلب الأسئلة عند فتح الموقع
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/questions?is_active=eq.true&select=*`, { headers, cache: 'no-store' });
        const data = await res.json();
        
        if (data && data.length > 0) {
          const formattedQuestions = data.map(q => {
            const options = [q.option_a, q.option_b, q.option_c, q.option_d].sort(() => Math.random() - 0.5);
            return { question: q.question_text, options, correct: q.correct_answer };
          });
          // خلط ترتيب الأسئلة
          setQuestions(formattedQuestions.sort(() => Math.random() - 0.5));
        } else {
          // إذا لم يجد أسئلة، لا يزعج اللاعب، بل ينتظر حتى يسجل الدخول ليخبره
        }
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // مؤقت السؤال الواحد (10 ثواني)
  useEffect(() => {
    if (step === 'quiz' && !isPaused) {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        handleNextQuestion();
      }
    }
  }, [timeLeft, step, isPaused]);

  // دالة بدء الاختبار مع جميع الفحوصات الأمنية والزمنية
  const startQuiz = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. جلب التواريخ ورقم الأسبوع من الخادم
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_settings?id=eq.1&select=*`, { headers, cache: 'no-store' });
      const settingsData = await setRes.json();
      
      if (settingsData.length > 0) {
        const { start_datetime, end_datetime, current_week } = settingsData[0];
        
        // 2. التحقق من الوقت الحالي مقارنة بالتاريخ المجدول
        const now = new Date();
        const startTournamentTime = new Date(start_datetime);
        const endTournamentTime = new Date(end_datetime);

        if (now < startTournamentTime) {
          alert(`⏳ عذراً، المسابقة لم تفتح بعد!\nستفتح في: ${startTournamentTime.toLocaleString('ar-EG')}`);
          setIsLoading(false); return;
        }

        if (now > endTournamentTime) {
          alert(`⛔ عذراً، انتهت مسابقة هذا الأسبوع في: ${endTournamentTime.toLocaleString('ar-EG')}`);
          setIsLoading(false); return;
        }

        // 3. التحقق من القائمة السوداء (الحظر)
        const banRes = await fetch(`${SUPABASE_URL}/rest/v1/banned_users?jaco_id=eq.${jacoId}&select=jaco_id`, { headers, cache: 'no-store' });
        if ((await banRes.json()).length > 0) {
          alert("⛔ عذراً، لقد تم حظرك نهائياً من المشاركة في بطولات TOP.");
          setIsLoading(false); return;
        }

        // 4. التحقق من عدم مشاركة اللاعب مسبقاً في هذا الأسبوع
        const res = await fetch(`${SUPABASE_URL}/rest/v1/participants?jaco_id=eq.${jacoId}&week_number=eq.${currentWeek}&select=*`, { headers, cache: 'no-store' });
        if ((await res.json()).length > 0) {
          alert("❌ لقد شاركت بالفعل في مسابقة هذا الأسبوع. انتظر الأسبوع القادم.");
          setIsLoading(false); return;
        }
        
        // 5. التحقق من وجود أسئلة نشطة
        if (questions.length === 0) {
           alert("🛠️ المسابقة مفتوحة ولكن الإدارة لم تقم بسحب الأسئلة بعد. حاول لاحقاً.");
           setIsLoading(false); return;
        }
      }

      // كل شيء سليم، ابدأ الاختبار وابدأ المؤقت الكلي
      setStartTime(Date.now());
      setStep('quiz');
      setTimeLeft(10);
      setIsLoading(false);
    } catch (error) {
      alert("حدث خطأ في الاتصال بالخادم.");
      setIsLoading(false);
    }
  };

  const handleAnswerClick = (option: any) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);
    setIsPaused(true);

    let currentScore = score;
    if (option === questions[currentQuestionIndex].correct) {
      currentScore = score + 1;
      setScore(currentScore);
    }
    setTimeout(() => { handleNextQuestion(currentScore); }, 1500); 
  };

  const handleNextQuestion = async (latestScore = score) => {
    setSelectedAnswer(null);
    setIsPaused(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeLeft(10); 
    } else {
      setStep('saving');
      
      // حساب الوقت المستغرق بالثواني
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      try {
        const setRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_settings?id=eq.1&select=current_week`, { headers });
        const currentWeek = (await setRes.json())[0].current_week;

        await fetch(`${SUPABASE_URL}/rest/v1/participants`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            jaco_username: username,
            jaco_id: jacoId,
            score: latestScore,
            total_time_ms: timeTaken, // حفظ الوقت لكسر التعادل
            week_number: currentWeek
          })
        });
        setStep('finished'); 
      } catch (error) {
        console.error(error);
      }
    }
  };

  const getButtonClass = (option: any) => {
    const currentQ = questions[currentQuestionIndex];
    if (selectedAnswer === null) return "bg-black/50 border-gray-600 hover:border-yellow-500 hover:bg-yellow-500/20";
    if (option === currentQ.correct) return "bg-green-500/20 border-green-500 text-green-400 font-bold scale-105 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
    if (selectedAnswer === option && option !== currentQ.correct) return "bg-red-500/20 border-red-500 text-red-400 font-bold scale-95 opacity-50";
    return "bg-black/50 border-gray-600 opacity-50";
  };

  if (isLoading && step === 'login') return <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center font-bold text-2xl animate-pulse" dir="rtl">جاري الاتصال بخوادم TOP... 👑</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans relative overflow-hidden" dir="rtl">
      
      {/* إضاءة الخلفية */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-yellow-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-900/10 rounded-full blur-[150px] pointer-events-none"></div>

      {step === 'login' && (
        <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-2xl w-[90%] max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
              <span className="text-4xl">🦅</span>
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 tracking-wider">
              TOP
            </h1>
            <p className="text-gray-400 text-sm mt-2 font-bold tracking-widest uppercase">Weekly Challenge</p>
          </div>
          
          <form onSubmit={startQuiz} className="space-y-5">
            <div>
              <label className="text-xs text-gray-400 block mb-1">اسم المتسابق (JACO Username)</label>
              <input type="text" required placeholder="أدخل اسمك" onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#111] border border-gray-800 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 transition" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">رقم اللاعب (JACO ID)</label>
              <input type="number" required placeholder="أدخل الـ ID" onChange={(e) => setJacoId(e.target.value)} className="w-full bg-[#111] border border-gray-800 text-white rounded-xl p-3 focus:outline-none focus:border-yellow-500 transition" />
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black text-lg p-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] mt-6 transition-all transform hover:scale-[1.02]">
              {isLoading ? 'جاري التحقق...' : 'بدء الاختبار الآن 🚀'}
            </button>
          </form>
        </div>
      )}

      {step === 'quiz' && questions.length > 0 && (
        <div className="relative z-10 w-[90%] max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl transition-all duration-300">
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
            <span className="text-yellow-500 font-bold bg-yellow-900/20 px-4 py-1 rounded-full border border-yellow-500/30">
              السؤال {currentQuestionIndex + 1} من {questions.length}
            </span>
            <span className={`font-black text-3xl transition-all ${timeLeft <= 3 ? 'text-red-500 animate-pulse scale-110 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-white'}`}>
              ⏱️ {timeLeft}
            </span>
          </div>
          
          <h2 className="text-2xl font-bold mb-10 leading-relaxed text-white text-center">{questions[currentQuestionIndex].question}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions[currentQuestionIndex].options.map((option, index) => (
              <button 
                key={index} 
                onClick={() => handleAnswerClick(option)} 
                disabled={selectedAnswer !== null} 
                className={`border p-4 rounded-xl text-center text-lg font-bold transition-all duration-300 ${getButtonClass(option)}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="relative z-10 flex flex-col items-center">
           <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="text-yellow-500 text-2xl font-bold animate-pulse tracking-widest">جاري تشفير وحفظ نتيجتك... 🔒</p>
        </div>
      )}
      
      {step === 'finished' && (
        <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-yellow-500/30 p-10 rounded-3xl text-center w-[90%] max-w-md shadow-2xl">
          <div className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]">✅</div>
          <h2 className="text-3xl font-black text-yellow-500 mb-2">تم الاستلام بنجاح</h2>
          <p className="text-gray-300 text-lg mb-6">شكراً لمشاركتك يا بطل.</p>
          <div className="bg-black/50 border border-white/5 p-4 rounded-xl">
             <p className="text-gray-400 text-sm font-bold">🔒 النتائج سرية تماماً.</p>
             <p className="text-gray-500 text-xs mt-2">سيتم إعلان الفائزين وترتيب الصدارة يوم الجمعة أثناء البث الرسمي لـ TOP.</p>
          </div>
        </div>
      )}
    </div>
  );
}
