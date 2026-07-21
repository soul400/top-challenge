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
  
  // حساب الوقت الكلي للمتسابق
  const [startTime, setStartTime] = useState(null);

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
          setQuestions(formattedQuestions.sort(() => Math.random() - 0.5));
        } else {
          alert("عذراً، لم تبدأ مسابقة هذا الأسبوع بعد!");
        }
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, []);

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

  const startQuiz = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. التحقق من القائمة السوداء (Blacklist Check)
      const banRes = await fetch(`${SUPABASE_URL}/rest/v1/banned_users?jaco_id=eq.${jacoId}&select=jaco_id`, { headers, cache: 'no-store' });
      const banData = await banRes.json();
      if (banData.length > 0) {
        alert("⛔ عذراً، لقد تم حظرك نهائياً من المشاركة في بطولات TOP لوجود مخالفات. لا يمكنك الدخول.");
        setIsLoading(false); return;
      }

      // 2. التحقق من رقم الأسبوع الحالي
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/tournament_settings?id=eq.1&select=current_week`, { headers, cache: 'no-store' });
      const currentWeek = (await setRes.json())[0].current_week;

      // 3. التحقق من عدم مشاركة اللاعب في هذا الأسبوع مسبقاً
      const res = await fetch(`${SUPABASE_URL}/rest/v1/participants?jaco_id=eq.${jacoId}&week_number=eq.${currentWeek}&select=*`, { headers, cache: 'no-store' });
      if ((await res.json()).length > 0) {
        alert("❌ عذراً! لقد شاركت بالفعل في مسابقة هذا الأسبوع. انتظر الأسبوع القادم.");
        setIsLoading(false); return;
      }

      // 4. كل شيء سليم، ابدأ الاختبار
      setStartTime(Date.now());
      setStep('quiz');
      setTimeLeft(10);
      setIsLoading(false);
    } catch (error) {
      alert("حدث خطأ في الاتصال بالخادم.");
      setIsLoading(false);
    }
  };

  const handleAnswerClick = (option) => {
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
            total_time_ms: timeTaken, // حفظ الوقت هنا (استخدمنا عمود total_time_ms الذي أنشأناه في البداية)
            week_number: currentWeek
          })
        });
        setStep('finished'); 
      } catch (error) {
        console.error(error);
      }
    }
  };

  const getButtonClass = (option) => {
    const currentQ = questions[currentQuestionIndex];
    if (selectedAnswer === null) return "bg-black/50 border-gray-600 hover:border-yellow-500 hover:bg-yellow-500/20";
    if (option === currentQ.correct) return "bg-green-500/20 border-green-500 text-green-400 font-bold scale-105 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
    if (selectedAnswer === option && option !== currentQ.correct) return "bg-red-500/20 border-red-500 text-red-400 font-bold scale-95 opacity-50";
    return "bg-black/50 border-gray-600 opacity-50";
  };

  if (isLoading && step === 'login') return <div className="min-h-screen bg-black text-yellow-500 flex items-center justify-center font-bold">جاري الاتصال بقاعدة البيانات... ⏳</div>;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-sans relative overflow-hidden" dir="rtl">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      
      {step === 'login' && (
        <div className="relative z-10 bg-white/5 backdrop-blur-lg border border-yellow-500/30 p-10 rounded-2xl w-[90%] max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2">TOP Challenge</h1>
          </div>
          <form onSubmit={startQuiz} className="space-y-5">
            <input type="text" required placeholder="اسم مستخدم جاكو" onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/50 border border-gray-600 text-white rounded-lg p-3 focus:border-yellow-500" />
            <input type="number" required placeholder="ID جاكو" onChange={(e) => setJacoId(e.target.value)} className="w-full bg-black/50 border border-gray-600 text-white rounded-lg p-3 focus:border-yellow-500" />
            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold p-3 rounded-lg mt-6 hover:scale-105 transition">{isLoading ? 'جاري التحقق...' : 'بدء الاختبار الآن 🚀'}</button>
          </form>
        </div>
      )}

      {step === 'quiz' && questions.length > 0 && (
        <div className="relative z-10 w-[90%] max-w-2xl bg-white/5 backdrop-blur-lg border border-yellow-500/30 p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-yellow-500 font-bold">السؤال {currentQuestionIndex + 1} / {questions.length}</span>
            <span className={`font-bold text-2xl ${timeLeft <= 3 ? 'text-red-500 animate-pulse scale-110' : 'text-white'}`}>⏱️ {timeLeft}</span>
          </div>
          <h2 className="text-2xl font-bold mb-8">{questions[currentQuestionIndex].question}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions[currentQuestionIndex].options.map((option, index) => (
              <button key={index} onClick={() => handleAnswerClick(option)} disabled={selectedAnswer !== null} className={`border p-4 rounded-xl text-right transition ${getButtonClass(option)}`}>{option}</button>
            ))}
          </div>
        </div>
      )}

      {step === 'saving' && <div className="text-yellow-500 text-xl font-bold animate-pulse z-10">جاري الحفظ... 🔒</div>}
      
      {step === 'finished' && (
        <div className="relative z-10 bg-white/5 border border-yellow-500/30 p-10 rounded-2xl text-center w-[90%] max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">تم استلام مشاركتك بنجاح</h2>
          <p className="text-gray-400 text-sm mt-4 p-3 bg-black/40 rounded-lg">النتائج سرية، سيتم إعلان الفائزين يوم الجمعة أثناء بث TOP.</p>
        </div>
      )}
    </div>
  );
}