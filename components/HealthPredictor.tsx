import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VitalSignsInput, AIPrediction, ParticleState, NodePosition, VitalAnalysisDetail, RecommendationItem } from '../types';
import { analyzeHealthWithGemini } from '../services/geminiService';
import { UI_COLORS, NETWORK_STRUCTURE, INPUT_LABELS, OUTPUT_LABELS, STATUS_BG_COLORS_TAILWIND, STATUS_TEXT_COLORS_TAILWIND, RISK_TEXT_COLORS_TAILWIND, URGENCY_TEXT_COLORS_TAILWIND } from '../constants';

class Particle implements ParticleState {
  startX: number; startY: number; endX: number; endY: number;
  x: number; y: number; progress: number; speed: number;
  size: number; color: string; life: number;

  constructor(startX: number, startY: number, endX: number, endY: number, value: number, color: string = UI_COLORS.primary) {
    this.startX = startX; this.startY = startY;
    this.endX = endX; this.endY = endY;
    this.x = startX; this.y = startY;
    this.progress = 0;
    this.speed = 0.002 + Math.random() * 0.003;
    this.size = Math.max(1, 1 + value * 2);
    this.color = color;
    this.life = 1;
  }

  UPD() {
    this.progress += this.speed;
    this.life = 1 - (this.progress * 0.5);
    const __easeProg = 1 - Math.pow(1 - this.progress, 3);
    this.x = this.startX + (this.endX - this.startX) * __easeProg;
    this.y = this.startY + (this.endY - this.startY) * __easeProg;
  }

  DRW(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  DIE() {
    return this.progress >= 1;
  }
}

const HealthPredictor: React.FC = () => {
  const [__isLoad, __setLoad] = useState(false);
  const [__statMsg, __setStat] = useState('READY FOR ANALYSIS');
  const [__errMsg, __setErr] = useState<string | null>(null);
  const [__predic, __setPred] = useState<AIPrediction | null>(null);
  const [__animPh, __setAnim] = useState<'idle' | 'processing' | 'complete'>('idle');

  const [__systol, __setSyst] = useState<number | string>(120);
  const [__diasto, __setDias] = useState<number | string>(80);
  const [__heartR, __setHear] = useState<number | string>(75);
  const [__oxyLev, __setOxy] = useState<number | string>(98);
  const [__bodyTe, __setBod] = useState<number | string>(36.6);
  const [__weathe, __setWea] = useState<number | string>(22);
  const [__stepsC, __setSte] = useState<number | string>(5000);

  const __canvRef = useRef<HTMLCanvasElement>(null);
  const __animRef = useRef<number | null>(null);
  const __partRef = useRef<Particle[]>([]);
  const __nodeRef = useRef<{ input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } | null>(null);

  const __canvWid = 400;
  const __canvHei = 300;

  useEffect(() => {
    const CAL = (): { input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } => {
        const __posits: { input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } = { input: [], hidden: [], output: [] };
        const __layerS = __canvWid / (NETWORK_STRUCTURE.hidden.length + 2);
        
        const __inputS = __canvHei / (NETWORK_STRUCTURE.input + 1);
        for (let i = 0; i < NETWORK_STRUCTURE.input; i++) {
            __posits.input.push({ x: __layerS * 0.5, y: __inputS * (i + 1), value: 0, label: INPUT_LABELS[i] });
        }

        NETWORK_STRUCTURE.hidden.forEach((nodeCount, layerIndex) => {
            const __layerN: NodePosition[] = [];
            const __hiddenL = __canvHei / (nodeCount + 1);
            for (let i = 0; i < nodeCount; i++) {
                __layerN.push({ x: __layerS * (layerIndex + 1.5), y: __hiddenL * (i + 1), value: 0, activation: 0 });
            }
            __posits.hidden.push(__layerN);
        });

        const __outputS = __canvHei / (NETWORK_STRUCTURE.output + 1);
        for (let i = 0; i < NETWORK_STRUCTURE.output; i++) {
            __posits.output.push({ x: __layerS * (NETWORK_STRUCTURE.hidden.length + 1.5), y: __outputS * (i + 1), value: 0, label: OUTPUT_LABELS[i] });
        }
        return __posits;
    };
    __nodeRef.current = CAL();
  }, []);

  const DRN = useCallback((ctx: CanvasRenderingContext2D, __currIn: number[], __currOut: number[]) => {
    if (!__nodeRef.current) return;
    const { input: __inputN, hidden: __hiddenL, output: __outputN } = __nodeRef.current;

    ctx.fillStyle = UI_COLORS.background;
    ctx.fillRect(0, 0, __canvWid, __canvHei);

    __inputN.forEach((node, i) => { node.value = __currIn[i] || 0; });
    __outputN.forEach((node, i) => { node.value = (__currOut[i] || 0) / 100; });
    __hiddenL.forEach(layer => layer.forEach(node => node.activation = Math.random() * 0.5 + 0.2));

    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.2;

    __inputN.forEach(__inputNode => {
        __hiddenL[0].forEach(__hiddenNode => {
            ctx.strokeStyle = UI_COLORS.primary;
            ctx.beginPath(); ctx.moveTo(__inputNode.x, __inputNode.y); ctx.lineTo(__hiddenNode.x, __hiddenNode.y); ctx.stroke();
        });
    });

    for (let i = 0; i < NETWORK_STRUCTURE.hidden.length - 1; i++) {
        __hiddenL[i].forEach(__currentNode => {
            __hiddenL[i+1].forEach(__nextNode => {
                ctx.strokeStyle = UI_COLORS.secondary;
                ctx.beginPath(); ctx.moveTo(__currentNode.x, __currentNode.y); ctx.lineTo(__nextNode.x, __nextNode.y); ctx.stroke();
            });
        });
    }
    
    const __lastHid = __hiddenL[__hiddenL.length - 1];
    __lastHid.forEach(__hiddenNode => {
        __outputN.forEach(__outputNode => {
            ctx.strokeStyle = UI_COLORS.accent;
            ctx.beginPath(); ctx.moveTo(__hiddenNode.x, __hiddenNode.y); ctx.lineTo(__outputNode.x, __outputNode.y); ctx.stroke();
        });
    });
    ctx.globalAlpha = 1;

    __inputN.forEach(node => {
        const __size = 5 + Math.min(node.value * 5, 5);
        ctx.fillStyle = UI_COLORS.primary;
        ctx.beginPath(); ctx.arc(node.x, node.y, __size, 0, Math.PI * 2); ctx.fill();
    });

    __hiddenL.forEach(layer => {
        layer.forEach(node => {
            const __size = 4 + (node.activation || 0) * 4;
            ctx.fillStyle = UI_COLORS.secondary;
            ctx.beginPath(); ctx.arc(node.x, node.y, __size, 0, Math.PI * 2); ctx.fill();
        });
    });
    
    const __outputC = [UI_COLORS.success, UI_COLORS.warning, UI_COLORS.critical];
    __outputN.forEach((node, i) => {
        const __probab = node.value;
        const __baseS = 6;
        const __dynSi = __probab * 10; 
        const __size = __baseS + Math.min(__dynSi, 8);
        
        ctx.fillStyle = __outputC[i % __outputC.length];
    
        if (__probab > 0.05) { 
            const __glowR = __size + __probab * 20; 
            const __glowA = Math.min(__probab * 0.8, 0.6); 
            
            ctx.save();
            ctx.shadowBlur = Math.min(__glowR, 30); 
            ctx.shadowColor = __outputC[i % __outputC.length];
            ctx.globalAlpha = __glowA; 
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, __size + 2 , 0, Math.PI * 2); 
            ctx.fill();
            ctx.restore();
        }
        
        ctx.fillStyle = __outputC[i % __outputC.length];
        ctx.beginPath();
        ctx.arc(node.x, node.y, __size, 0, Math.PI * 2);
        ctx.fill();
    
        if (__probab > 0) {
            ctx.fillStyle = UI_COLORS.background; 
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(__probab * 100)}%`, node.x, node.y);
        }
    });

    ctx.fillStyle = UI_COLORS.text;
    ctx.font = '8px monospace';
    __inputN.forEach(node => {
        ctx.textAlign = 'right';
        ctx.fillText(node.label || '', node.x - 10, node.y + 3);
    });
    __outputN.forEach(node => {
        ctx.textAlign = 'left';
        ctx.fillText(node.label || '', node.x + 10, node.y + 3);
    });

  }, [__canvWid, __canvHei]);

  const ANI = useCallback(() => {
    const __canvas = __canvRef.current;
    if (!__canvas || !__nodeRef.current) return;
    const __ctx = __canvas.getContext('2d');
    if (!__ctx) return;

    const __currVit: VitalSignsInput = {
        systolic: parseFloat(__systol as string),
        diastolic: parseFloat(__diasto as string),
        heartRate: parseFloat(__heartR as string),
        oxygenLevel: parseFloat(__oxyLev as string),
        bodyTemperature: parseFloat(__bodyTe as string),
        weatherTemperature: parseFloat(__weathe as string),
        stepsCount: parseFloat(__stepsC as string),
    };

    const __inputsN = [
        (__currVit.systolic - 60) / (250 - 60),
        (__currVit.diastolic - 40) / (150 - 40),
        (__currVit.heartRate - 30) / (200 - 30),
        (__currVit.oxygenLevel - 70) / (100 - 70),
        (__currVit.bodyTemperature - 32) / (45 - 32),
        (__currVit.weatherTemperature - (-10)) / (50 - (-10)),
        (__currVit.stepsCount - 0) / (20000 - 0)
    ].map(v => Math.max(0, Math.min(1, v || 0))); 

    const __outputs = __predic?.probabilities ? 
        [__predic.probabilities.normal, __predic.probabilities.abnormal, __predic.probabilities.critical] 
        : [33, 33, 34]; 

    DRN(__ctx, __inputsN, __outputs);

    __partRef.current = __partRef.current.filter(p => {
        p.UPD();
        p.DRW(__ctx);
        return !p.DIE();
    });
    
    if (__animPh === 'processing' && Math.random() < 0.3 && __nodeRef.current) { 
        const { input: __inputN, hidden: __hiddenL } = __nodeRef.current;
        if (__inputN.length > 0 && __hiddenL.length > 0 && __hiddenL[0].length > 0) {
            const __randIn = __inputN[Math.floor(Math.random() * __inputN.length)];
            const __randHi = __hiddenL[0][Math.floor(Math.random() * __hiddenL[0].length)];
            __partRef.current.push(new Particle(
                __randIn.x, __randIn.y,
                __randHi.x, __randHi.y,
                Math.random(), 
                Math.random() > 0.5 ? UI_COLORS.primary : UI_COLORS.accent
            ));
        }
    }

    if (__animPh !== 'idle' || __partRef.current.length > 0) {
      __animRef.current = requestAnimationFrame(ANI);
    }
  }, [__animPh, __predic, __systol, __diasto, __heartR, __oxyLev, __bodyTe, __weathe, __stepsC, DRN]);

  useEffect(() => {
    const __initAni = requestAnimationFrame(ANI);
    return () => {
      if (__animRef.current) {
        cancelAnimationFrame(__animRef.current);
      }
      cancelAnimationFrame(__initAni);
    };
  }, [ANI]);

  const STA = useCallback(() => {
    if (!__nodeRef.current) return;
    __setAnim('processing');
    __partRef.current = []; 
    
    const { input: __inputN, hidden: __hiddenL } = __nodeRef.current;
    if (__inputN.length > 0 && __hiddenL.length > 0 && __hiddenL[0].length > 0) {
        __inputN.forEach(__inputNode => {
            let __currInp = 0;
            switch(__inputNode.label) {
                                case INPUT_LABELS[0]: __currInp = (parseFloat(__systol as string) - 60) / (250 - 60); break;
                case INPUT_LABELS[1]: __currInp = (parseFloat(__diasto as string) - 40) / (150 - 40); break;
                case INPUT_LABELS[2]: __currInp = (parseFloat(__heartR as string) - 30) / (200 - 30); break;
                case INPUT_LABELS[3]: __currInp = (parseFloat(__oxyLev as string) - 70) / (100 - 70); break;
                case INPUT_LABELS[4]: __currInp = (parseFloat(__bodyTe as string) - 32) / (45 - 32); break;
                case INPUT_LABELS[5]: __currInp = (parseFloat(__weathe as string) - (-10)) / (50 - (-10)); break;
                case INPUT_LABELS[6]: __currInp = (parseFloat(__stepsC as string) - 0) / (20000 - 0); break;
            }
            __currInp = Math.max(0, Math.min(1, __currInp || 0));

            __hiddenL[0].forEach(__hiddenNode => {
                if (Math.random() < 0.25) { 
                     __partRef.current.push(new Particle(
                        __inputNode.x, __inputNode.y,
                        __hiddenNode.x, __hiddenNode.y,
                        __currInp, 
                        UI_COLORS.primary
                    ));
                }
            });
        });
    }
    
    if (__animRef.current) cancelAnimationFrame(__animRef.current);
    requestAnimationFrame(ANI);
  }, [ANI, __systol, __diasto, __heartR, __oxyLev, __bodyTe, __weathe, __stepsC]);

  const HAN = async () => {
    const __vitals: VitalSignsInput = {
      systolic: parseFloat(__systol as string),
      diastolic: parseFloat(__diasto as string),
      heartRate: parseFloat(__heartR as string),
      oxygenLevel: parseFloat(__oxyLev as string),
      bodyTemperature: parseFloat(__bodyTe as string),
      weatherTemperature: parseFloat(__weathe as string),
      stepsCount: parseFloat(__stepsC as string)
    };

    const __errors = [];
    if (isNaN(__vitals.systolic) || __vitals.systolic < 50 || __vitals.systolic > 300) __errors.push('Systolic BP: 50-300 mmHg');
    if (isNaN(__vitals.diastolic) || __vitals.diastolic < 30 || __vitals.diastolic > 200) __errors.push('Diastolic BP: 30-200 mmHg');
    if (isNaN(__vitals.heartRate) || __vitals.heartRate < 20 || __vitals.heartRate > 250) __errors.push('Heart Rate: 20-250 BPM');
    if (isNaN(__vitals.oxygenLevel) || __vitals.oxygenLevel < 60 || __vitals.oxygenLevel > 100) __errors.push('Oxygen Level: 60-100%');
    if (isNaN(__vitals.bodyTemperature) || __vitals.bodyTemperature < 30 || __vitals.bodyTemperature > 50) __errors.push('Body Temp: 30-50°C');
    if (isNaN(__vitals.weatherTemperature) || __vitals.weatherTemperature < -50 || __vitals.weatherTemperature > 60) __errors.push('Weather Temp: -50-60°C');
    if (isNaN(__vitals.stepsCount) || __vitals.stepsCount < 0 || __vitals.stepsCount > 50000) __errors.push('Steps Count: 0-50,000');
    
    if (__errors.length > 0) {
      __setErr(`Invalid input(s): ${__errors.join(', ')}.`);
      __setAnim('idle'); 
      return;
    }

    __setLoad(true);
    __setErr(null);
    __setStat('ANALYZING VITAL SIGNS...');
    __setPred(null); 
    STA();

    const __result = await analyzeHealthWithGemini(__vitals);

    if (__result.success && __result.analysis) {
      __setPred(__result.analysis);
      __setStat(`ANALYSIS COMPLETE - STATUS: ${__result.analysis.overallStatus.toUpperCase()}`);
      __setAnim('complete');
    } else {
      __setErr(__result.message || 'Analysis failed. Please try again.');
      __setStat('ANALYSIS FAILED');
      __setAnim('idle'); 
    }
    __setLoad(false);
  };
  
  const GTB = (__status?: string): string => {
    if (!__status) return STATUS_BG_COLORS_TAILWIND.Default;
    const __normSt = __status.toLowerCase().replace(/[\s\(\)-]+/g, '');
    const __foundK = Object.keys(STATUS_BG_COLORS_TAILWIND).find(k => 
        k.toLowerCase().replace(/[\s\(\)-]+/g, '') === __normSt
    );
    return __foundK ? STATUS_BG_COLORS_TAILWIND[__foundK as keyof typeof STATUS_BG_COLORS_TAILWIND] : STATUS_BG_COLORS_TAILWIND.Default;
  };

  const GTR = (__riskL?: string): string => {
    if (!__riskL) return RISK_TEXT_COLORS_TAILWIND.Default;
    const __key = Object.keys(RISK_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase() === __riskL.toLowerCase());
    return __key ? RISK_TEXT_COLORS_TAILWIND[__key as keyof typeof RISK_TEXT_COLORS_TAILWIND] : RISK_TEXT_COLORS_TAILWIND.Default;
  };
  
  const GTU = (__urgenc?: string): string => {
    if (!__urgenc) return URGENCY_TEXT_COLORS_TAILWIND.Default;
    const __normUr = __urgenc.toLowerCase().replace(/\s+/g, '');
    const __key = Object.keys(URGENCY_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase().replace(/\s+/g, '') === __normUr);
    return __key ? URGENCY_TEXT_COLORS_TAILWIND[__key as keyof typeof URGENCY_TEXT_COLORS_TAILWIND] : URGENCY_TEXT_COLORS_TAILWIND.Default;
  };

  const GSC = (__colorC: string): string => {
    if (__colorC.startsWith('text-')) {
      return `${__colorC.replace('text-', 'bg-')} bg-opacity-70`;
    }
    if (__colorC.startsWith('bg-')) {
        return `${__colorC} bg-opacity-70`;
    }
    return `${STATUS_BG_COLORS_TAILWIND.Default} bg-opacity-70`;
  };

  const GRI = (__type: RecommendationItem['type']): string => {
    switch (__type) {
        case 'Lifestyle': return '🏃';
        case 'Dietary': return '🥗';
        case 'Consultation': return '🧑‍⚕️';
        case 'Monitoring': return '⏱️';
        case 'General': return '💡';
        default: return '💡';
    }
  };

  const RVI = (__label: string, __value: number | string, __setter: (val: string) => void, __unit: string, __min: number, __max: number, __step?: number, __ariaD?: string) => (
    <div className="flex-1 min-w-[150px]">
      <label htmlFor={`${__label.toLowerCase().replace(/\s/g, '-')}-input`} className="block text-sm font-medium text-slate-300 mb-1">{__label}</label>
      <div className="flex items-center bg-slate-700 rounded-md shadow-sm">
        <input
          id={`${__label.toLowerCase().replace(/\s/g, '-')}-input`}
          type="number"
          value={__value}
          onChange={(e) => __setter(e.target.value)}
          min={__min}
          max={__max}
          step={__step || 1}
          disabled={__isLoad}
          aria-label={`${__label} input in ${__unit}`}
          aria-describedby={__ariaD}
          className="w-full p-2 bg-transparent border-none rounded-md text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          style={{ MozAppearance: 'textfield' }} 
        />
        <span className="px-3 text-slate-400 text-sm" aria-hidden="true">{__unit}</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 bg-slate-800 rounded-lg shadow-2xl">
      <header className="mb-6 text-center" role="banner">
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
          AI Health Predictor
        </h1>
        <p 
          id="status-message"
          className={`mt-2 text-sm ${__isLoad ? 'text-yellow-400 animate-pulse' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {__statMsg}
        </p>
        {__errMsg && (
          <div 
            id="error-message-banner"
            className="mt-2 p-3 bg-red-700/50 text-red-300 border border-red-500 rounded-md text-sm"
            role="alert"
          >
            <span className="font-bold">⚠️ Error:</span> {__errMsg}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <section aria-labelledby="vitals-input-heading" className="bg-slate-700/50 p-6 rounded-lg shadow-lg">
          <h2 id="vitals-input-heading" className="text-xl font-semibold mb-4 text-cyan-400 border-b border-slate-600 pb-2">Vital Signs Input</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RVI("Systolic BP", __systol, (v) => __setSyst(v), "mmHg", 50, 300, 1, "error-message-banner status-message")}
            {RVI("Diastolic BP", __diasto, (v) => __setDias(v), "mmHg", 30, 200, 1, "error-message-banner status-message")}
            {RVI("Heart Rate", __heartR, (v) => __setHear(v), "BPM", 20, 250, 1, "error-message-banner status-message")}
            {RVI("Oxygen Saturation", __oxyLev, (v) => __setOxy(v), "%", 60, 100, 0.1, "error-message-banner status-message")}
            {RVI("Body Temperature", __bodyTe, (v) => __setBod(v), "°C", 30, 50, 0.1, "error-message-banner status-message")}
            {RVI("Weather Temperature", __weathe, (v) => __setWea(v), "°C", -50, 60, 0.1, "error-message-banner status-message")}
            {RVI("Daily Steps Count", __stepsC, (v) => __setSte(v), "steps", 0, 50000, 100, "error-message-banner status-message")}
          </div>
          <button
            onClick={HAN}
            disabled={__isLoad}
            aria-disabled={__isLoad}
            aria-live="polite" 
            className={`mt-6 w-full py-3 px-4 font-semibold rounded-md transition-all duration-300 ease-in-out
                        ${__isLoad ? 'bg-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:ring-4 focus:ring-cyan-400/50 transform hover:scale-105'}
                        text-white flex items-center justify-center space-x-2`}
          >
            {__isLoad ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ANALYZING...
              </>
            ) : (
              "🔬 ANALYZE HEALTH"
            )}
          </button>
        </section>

        <section aria-labelledby="visualization-heading" className="bg-slate-700/50 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[340px]">
          <h2 id="visualization-heading" className="text-xl font-semibold mb-2 text-pink-400 text-center">AI Processing Visualization</h2>
           <div 
              className="relative bg-slate-800 rounded-md overflow-hidden shadow-inner"
              style={{ width: `${__canvWid}px`, height: `${__canvHei}px` }}
            >
            <canvas ref={__canvRef} width={__canvWid} height={__canvHei} className="absolute top-0 left-0" aria-label="Conceptual neural network animation" />
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-slate-300 capitalize" aria-live="polite">
                {__animPh}
            </div>
          </div>
           <p className="text-xs text-slate-500 mt-2 text-center">Neural network activity (conceptual)</p>
        </section>
      </div>

       <section aria-labelledby="quick-presets-heading" className="mb-8 bg-slate-700/50 p-6 rounded-lg shadow-lg">
-
        <h3 id="quick-presets-heading" className="text-lg font-semibold text-slate-300 mb-3">Quick Test Scenarios</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Normal', color: 'green', vitals: { s: 120, d: 80, hr: 70, o2: 98, bt: 36.8, wt: 20, sc: 8000 } },
            { name: 'Slightly Elevated', color: 'yellow', vitals: { s: 145, d: 92, hr: 95, o2: 95, bt: 37.6, wt: 30, sc: 4000 } },
            { name: 'High Risk', color: 'orange', vitals: { s: 170, d: 105, hr: 115, o2: 91, bt: 38.5, wt: 5, sc: 1500 } },
            { name: 'Critical', color: 'red', vitals: { s: 190, d: 115, hr: 130, o2: 85, bt: 39.5, wt: 35, sc: 500 } },
          ].map(__preset => (
            <button
              key={__preset.name}
              onClick={() => {
                __setSyst(__preset.vitals.s); __setDias(__preset.vitals.d); __setHear(__preset.vitals.hr);
                __setOxy(__preset.vitals.o2); __setBod(__preset.vitals.bt);
                __setWea(__preset.vitals.wt); __setSte(__preset.vitals.sc);
                __setPred(null); 
                __setAnim('idle'); 
                __setStat('READY FOR ANALYSIS');
                __setErr(null);
              }}
              disabled={__isLoad}
              aria-disabled={__isLoad}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 border-2
                          border-${__preset.color}-500 text-${__preset.color}-400 hover:bg-${__preset.color}-500 hover:bg-opacity-30
                          disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-${__preset.color}-400`}
            >
              {__preset.name.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {__predic && (
        <section aria-labelledby="results-heading" className="bg-slate-700/30 p-6 rounded-lg shadow-xl animate-fadeIn" role="region">
          <h2 id="results-heading" className="text-2xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-teal-400 to-sky-400">
            AI Health Analysis Results
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
            <div className={`p-4 rounded-lg shadow ${GSC(GTB(__predic.overallStatus))}`}>
              <div className="text-sm font-medium text-white/80">OVERALL STATUS</div>
              <div className="text-2xl font-bold text-white">{__predic.overallStatus.toUpperCase()}</div>
            </div>
            <div className={`p-4 rounded-lg shadow ${GSC(GTR(__predic.riskLevel))}`}>
              <div className="text-sm font-medium text-white/80">RISK LEVEL</div>
              <div className={`text-2xl font-bold ${GTR(__predic.riskLevel)}`}>{__predic.riskLevel.toUpperCase()}</div>
            </div>
             <div className={`p-4 rounded-lg shadow ${GSC(GTU(__predic.urgency))}`}>
              <div className="text-sm font-medium text-white/80">URGENCY</div>
              <div className={`text-2xl font-bold ${GTU(__predic.urgency)}`}>{__predic.urgency.toUpperCase()}</div>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-slate-700 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Confidence & Probabilities</h3>
            <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                <div className="text-center">
                    <div className="text-3xl font-bold text-cyan-400">{__predic.confidence}%</div>
                    <div className="text-sm text-slate-400">Confidence</div>
                </div>
                <div className="flex space-x-2 sm:space-x-4">
                    {Object.entries(__predic.probabilities).map(([__key, __value]) => (
                    <div key={__key} className="text-center p-2 rounded-md bg-slate-600/50 min-w-[70px]">
                        <div className={`text-xl sm:text-2xl font-semibold ${__key === 'normal' ? 'text-green-400' : __key === 'abnormal' ? 'text-yellow-400' : 'text-red-500'}`}>{__value}%</div>
                        <div className="text-xs text-slate-500 capitalize">{__key}</div>
                    </div>
                    ))}
                </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-3">Detailed Vital Signs Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(__predic.vitalAnalysis).map(([__vitalK, __analys]) => {
                const __typedA = __analys as VitalAnalysisDetail; 
                if (!__typedA || !__typedA.status || !__typedA.concern) return null; 
                
                const __baseBg = GTB(__typedA.status);
                const __statTx = Object.keys(STATUS_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase().replace(/[\s\(\)-]+/g, '') === __typedA.status.toLowerCase().replace(/[\s\(\)-]+/g, '')) as keyof typeof STATUS_TEXT_COLORS_TAILWIND;
                const __statCo = __statTx ? STATUS_TEXT_COLORS_TAILWIND[__statTx] : STATUS_TEXT_COLORS_TAILWIND.Default;

                return (
                <div key={__vitalK} className={`p-4 rounded-lg shadow-md ${__baseBg} bg-opacity-30 border ${__baseBg.replace('bg-', 'border-')} border-opacity-50`}>
                  <h4 className={`font-semibold capitalize text-white opacity-90`}>{__vitalK.replace(/([A-Z](?=[a-z]))|([A-Z]+(?=[A-Z][a-z]))/g, ' $1$2').trim()} {__typedA.value ? `(${__typedA.value})` : ''}</h4>
                  <p className={`text-lg font-bold ${__statCo}`}>{__typedA.status.toUpperCase()}</p>
                  <p className={`text-sm mt-1 text-white opacity-80`}>{__typedA.concern}</p>
                </div>
              )})}
            </div>
          </div>

          {__predic.keyFindings && __predic.keyFindings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Key Clinical Findings</h3>
              <ul className="space-y-2">
                {__predic.keyFindings.map((__findin, __index) => (
                  <li key={__index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-cyan-400 mr-3 text-xl" aria-hidden="true">🔍</span>
                    <span className="text-slate-300">{__findin}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {__predic.recommendations && __predic.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {__predic.recommendations.map((__rec, __index) => (
                  <li key={__index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-pink-400 mr-3 text-xl" aria-hidden="true">{GRI(__rec.type)}</span>
                    <div>
                        <strong className="text-pink-300 capitalize">{__rec.type}: </strong>
                        <span className="text-slate-300">{__rec.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {__predic.preventiveMeasures && __predic.preventiveMeasures.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Preventive Measures</h3>
              <ul className="space-y-2">
                {__predic.preventiveMeasures.map((__measur, __index) => (
                  <li key={__index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-teal-400 mr-3 text-xl" aria-hidden="true">🛡️</span>
                    <span className="text-slate-300">{__measur}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="mt-12 text-center" role="contentinfo">
        <p className="text-xs text-slate-500 p-4 border border-yellow-700/50 bg-yellow-500/10 rounded-md">
          <strong>⚠️ MEDICAL DISCLAIMER:</strong> This AI analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for any health concerns or before making any decisions related to your health. Do not disregard professional medical advice or delay seeking it because of something you have read or interpreted from this application.
        </p>
        <p className="mt-4 text-sm text-slate-600">Powered by Gemini AI</p>
      </footer>
       <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .border-green-500 { border-color: #22c55e; } .text-green-400 { color: #4ade80; } .text-green-300 { color: #86efac; }
        .hover\\:bg-green-500:hover { --tw-bg-opacity: 1; background-color: rgb(34 197 94 / var(--tw-bg-opacity));}

        .border-yellow-500 { border-color: #eab308; } .text-yellow-400 { color: #facc15; } .text-yellow-300 { color: #fde047; }
        .hover\\:bg-yellow-500:hover { --tw-bg-opacity: 1; background-color: rgb(234 179 8 / var(--tw-bg-opacity)); }
        
        .border-orange-500 { border-color: #f97316; } .text-orange-400 { color: #fb923c; } .text-orange-300 { color: #fdba74; }
        .hover\\:bg-orange-500:hover { --tw-bg-opacity: 1; background-color: rgb(249 115 22 / var(--tw-bg-opacity)); }

        .border-red-500 { border-color: #ef4444; } .border-red-600 { border-color: #dc2626; }
        .text-red-500 { color: #ef4444; } .text-red-300 { color: #fca5a5; }
        .hover\\:bg-red-500:hover { --tw-bg-opacity: 1; background-color: rgb(239 68 68 / var(--tw-bg-opacity)); }

        .border-blue-500 { border-color: #3b82f6; } .text-blue-400 { color: #60a5fa; } .text-blue-300 { color: #93c5fd; }
        .border-slate-500 { border-color: #64748b; } .text-slate-300 { color: #cbd5e1; } .text-slate-200 { color: #e2e8f0; }

        .bg-opacity-30 { --tw-bg-opacity: 0.3 !important; }
        .bg-opacity-50 { --tw-bg-opacity: 0.5 !important; }
        .bg-opacity-70 { --tw-bg-opacity: 0.7 !important; }
        .border-opacity-50 { --tw-border-opacity: 0.5 !important; }

        .bg-slate-700\\/30 { background-color: rgba(51, 65, 85, 0.3); }
        .bg-slate-700\\/50 { background-color: rgba(51, 65, 85, 0.5); }
        .bg-slate-700\\/70 { background-color: rgba(51, 65, 85, 0.7); }
        .bg-red-700\\/50 { background-color: rgba(185, 28, 28, 0.5); }
        .bg-yellow-500\\/10 { background-color: rgba(234, 179, 8, 0.1); }

      `}</style>
    </div>
  );
};

export default HealthPredictor;
