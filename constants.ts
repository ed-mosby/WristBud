
export const UI_COLORS = {
  primary: '#00f0ff', 
  secondary: '#ff00ff', 
  accent: '#ffcc00', 
  background: '#0a0a12',
  text: '#e0e0e0', 
  success: '#00ff88', 
  warning: '#ffae42', 
  critical: '#ff3366', 
  normal: '#00ff80', 
};

export const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

export const NETWORK_STRUCTURE = {
  input: 7,
  hidden: [10, 6],
  output: 3,
};

export const INPUT_LABELS = [
  'SYSTOLIC', 'DIASTOLIC', 'HEART RATE', 'OXYGEN', 'BODY TEMP', 'WEATHER', 'STEPS'
];
export const OUTPUT_LABELS = ['NORMAL', 'ABNORMAL', 'CRITICAL'];

export const STATUS_BG_COLORS_TAILWIND = {
  Normal: 'bg-green-600',
  Warning: 'bg-yellow-500',
  Critical: 'bg-red-600',
  Elevated: 'bg-yellow-400',
  High: 'bg-orange-500',
  'High Stage 1': 'bg-orange-500',
  'High Stage 2': 'bg-orange-600',
  Crisis: 'bg-red-700',
  Low: 'bg-blue-500', 
  'Low (Bradycardia)': 'bg-yellow-500', 
  'High (Tachycardia)': 'bg-yellow-500', 
  'Low (Hypoxemia)': 'bg-orange-600', 
  Fever: 'bg-orange-500',
  Hypothermia: 'bg-blue-400',
  'Cold Stress': 'bg-sky-400',
  'Heat Stress': 'bg-amber-500',
  Optimal: 'bg-emerald-500',
  Sedentary: 'bg-slate-400',
  'Lightly Active': 'bg-lime-500',
  'Moderately Active': 'bg-green-500',
  Active: 'bg-teal-500',
  'Very Active': 'bg-cyan-500',
  Neutral: 'bg-slate-500',
  Default: 'bg-slate-600',
};

export const STATUS_TEXT_COLORS_TAILWIND = {
  Normal: 'text-green-400',
  Warning: 'text-yellow-400', 
  Critical: 'text-red-400', 
  Elevated: 'text-yellow-300',
  High: 'text-orange-400',
  'High Stage 1': 'text-orange-400',
  'High Stage 2': 'text-orange-300',
  Crisis: 'text-red-300',
  Low: 'text-blue-400',
  'Low (Bradycardia)': 'text-yellow-300',
  'High (Tachycardia)': 'text-yellow-300',
  'Low (Hypoxemia)': 'text-orange-300',
  Fever: 'text-orange-400',
  Hypothermia: 'text-blue-300',
  'Cold Stress': 'text-sky-300',
  'Heat Stress': 'text-amber-300',
  Optimal: 'text-emerald-300',
  Sedentary: 'text-slate-300',
  'Lightly Active': 'text-lime-300',
  'Moderately Active': 'text-green-300',
  Active: 'text-teal-300',
  'Very Active': 'text-cyan-300',
  Neutral: 'text-slate-300',
  Default: 'text-slate-400',
};


export const RISK_TEXT_COLORS_TAILWIND = {
  Low: 'text-green-400',
  Moderate: 'text-yellow-400',
  High: 'text-orange-400',
  Severe: 'text-red-400',
  Default: 'text-slate-300',
};

export const URGENCY_TEXT_COLORS_TAILWIND = {
  Routine: 'text-green-400',
  Monitor: 'text-yellow-400',
  'Seek Care': 'text-orange-400',
  Emergency: 'text-red-400',
  Default: 'text-slate-300',
};

export const SUMMARY_CARD_TEXT_COLOR = 'text-white';
