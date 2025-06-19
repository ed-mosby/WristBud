
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VitalSignsInput, AIPrediction, ParticleState, NodePosition, VitalAnalysisDetail, RecommendationItem } from '../types';
import { analyzeHealthWithGemini } from '../services/geminiService';
import { UI_COLORS, NETWORK_STRUCTURE, INPUT_LABELS, OUTPUT_LABELS, STATUS_BG_COLORS_TAILWIND, STATUS_TEXT_COLORS_TAILWIND, RISK_TEXT_COLORS_TAILWIND, URGENCY_TEXT_COLORS_TAILWIND } from '../constants';

// Particle class for canvas animation
class Particle implements ParticleState {
  startX: number; startY: number; endX: number; endY: number;
  x: number; y: number; progress: number; speed: number;
  size: number; color: string; life: number;

  constructor(startX: number, startY: number, endX: number, endY: number, value: number, color: string = UI_COLORS.primary) {
    this.startX = startX; this.startY = startY;
    this.endX = endX; this.endY = endY;
    this.x = startX; this.y = startY;
    this.progress = 0;
    this.speed = 0.002 + Math.random() * 0.003; // Slower for clarity
    this.size = Math.max(1, 1 + value * 2); // Ensure size is at least 1
    this.color = color;
    this.life = 1;
  }

  update() {
    this.progress += this.speed;
    this.life = 1 - (this.progress * 0.5); // Fade out
    const easeProgress = 1 - Math.pow(1 - this.progress, 3); // Cubic ease-out
    this.x = this.startX + (this.endX - this.startX) * easeProgress;
    this.y = this.startY + (this.endY - this.startY) * easeProgress;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life); // Ensure alpha is not negative
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead() {
    return this.progress >= 1;
  }
}

const HealthPredictor: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('READY FOR ANALYSIS');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'processing' | 'complete'>('idle');

  // Vital Signs State
  const [systolic, setSystolic] = useState<number | string>(120);
  const [diastolic, setDiastolic] = useState<number | string>(80);
  const [heartRate, setHeartRate] = useState<number | string>(75);
  const [oxygenLevel, setOxygenLevel] = useState<number | string>(98);
  const [bodyTemperature, setBodyTemperature] = useState<number | string>(36.6);
  const [weatherTemperature, setWeatherTemperature] = useState<number | string>(22); // New
  const [stepsCount, setStepsCount] = useState<number | string>(5000); // New

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nodePositionsRef = useRef<{ input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } | null>(null);

  const canvasWidth = 400; // Adjusted for better fit
  const canvasHeight = 300; // Adjusted for better fit

  // Calculate node positions once
  useEffect(() => {
    const calculateNodePositions = (): { input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } => {
        const positions: { input: NodePosition[], hidden: NodePosition[][], output: NodePosition[] } = { input: [], hidden: [], output: [] };
        const layerSpacing = canvasWidth / (NETWORK_STRUCTURE.hidden.length + 2); // Input, Hidden layers, Output
        
        const inputSpacing = canvasHeight / (NETWORK_STRUCTURE.input + 1);
        for (let i = 0; i < NETWORK_STRUCTURE.input; i++) {
            positions.input.push({ x: layerSpacing * 0.5, y: inputSpacing * (i + 1), value: 0, label: INPUT_LABELS[i] });
        }

        NETWORK_STRUCTURE.hidden.forEach((nodeCount, layerIndex) => {
            const layerNodes: NodePosition[] = [];
            const hiddenLayerSpacing = canvasHeight / (nodeCount + 1);
            for (let i = 0; i < nodeCount; i++) {
                layerNodes.push({ x: layerSpacing * (layerIndex + 1.5), y: hiddenLayerSpacing * (i + 1), value: 0, activation: 0 });
            }
            positions.hidden.push(layerNodes);
        });

        const outputSpacing = canvasHeight / (NETWORK_STRUCTURE.output + 1);
        for (let i = 0; i < NETWORK_STRUCTURE.output; i++) {
            positions.output.push({ x: layerSpacing * (NETWORK_STRUCTURE.hidden.length + 1.5), y: outputSpacing * (i + 1), value: 0, label: OUTPUT_LABELS[i] });
        }
        return positions;
    };
    nodePositionsRef.current = calculateNodePositions();
  }, []);


  const drawNetwork = useCallback((ctx: CanvasRenderingContext2D, currentInputs: number[], currentOutputs: number[]) => {
    if (!nodePositionsRef.current) return;
    const { input: inputNodes, hidden: hiddenLayers, output: outputNodes } = nodePositionsRef.current;

    ctx.fillStyle = UI_COLORS.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Update node values
    inputNodes.forEach((node, i) => { node.value = currentInputs[i] || 0; });
    outputNodes.forEach((node, i) => { node.value = (currentOutputs[i] || 0) / 100; }); // Probabilities are 0-100
    hiddenLayers.forEach(layer => layer.forEach(node => node.activation = Math.random() * 0.5 + 0.2)); // Simulate activation

    // Draw connections
    ctx.lineWidth = 0.3; // Thinner lines
    ctx.globalAlpha = 0.2;

    inputNodes.forEach(inputNode => {
        hiddenLayers[0].forEach(hiddenNode => {
            ctx.strokeStyle = UI_COLORS.primary;
            ctx.beginPath(); ctx.moveTo(inputNode.x, inputNode.y); ctx.lineTo(hiddenNode.x, hiddenNode.y); ctx.stroke();
        });
    });

    for (let i = 0; i < NETWORK_STRUCTURE.hidden.length - 1; i++) {
        hiddenLayers[i].forEach(currentNode => {
            hiddenLayers[i+1].forEach(nextNode => {
                ctx.strokeStyle = UI_COLORS.secondary;
                ctx.beginPath(); ctx.moveTo(currentNode.x, currentNode.y); ctx.lineTo(nextNode.x, nextNode.y); ctx.stroke();
            });
        });
    }
    
    const lastHiddenLayer = hiddenLayers[hiddenLayers.length - 1];
    lastHiddenLayer.forEach(hiddenNode => {
        outputNodes.forEach(outputNode => {
            ctx.strokeStyle = UI_COLORS.accent;
            ctx.beginPath(); ctx.moveTo(hiddenNode.x, hiddenNode.y); ctx.lineTo(outputNode.x, outputNode.y); ctx.stroke();
        });
    });
    ctx.globalAlpha = 1;

    // Draw nodes
    inputNodes.forEach(node => {
        const size = 5 + Math.min(node.value * 5, 5); // Max size increase limited
        ctx.fillStyle = UI_COLORS.primary;
        ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, Math.PI * 2); ctx.fill();
    });

    hiddenLayers.forEach(layer => {
        layer.forEach(node => {
            const size = 4 + (node.activation || 0) * 4;
            ctx.fillStyle = UI_COLORS.secondary;
            ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, Math.PI * 2); ctx.fill();
        });
    });
    
    const outputColors = [UI_COLORS.success, UI_COLORS.warning, UI_COLORS.critical]; // Normal, Abnormal, Critical
    outputNodes.forEach((node, i) => {
        const probability = node.value; // This is already probability (0 to 1)
        const baseSize = 6;
        const dynamicSize = probability * 10; 
        const size = baseSize + Math.min(dynamicSize, 8);
        
        ctx.fillStyle = outputColors[i % outputColors.length];
    
        if (probability > 0.05) { 
            const glowRadius = size + probability * 20; 
            const glowAlpha = Math.min(probability * 0.8, 0.6); 
            
            ctx.save(); // Save context state before applying glow
            ctx.shadowBlur = Math.min(glowRadius, 30); 
            ctx.shadowColor = outputColors[i % outputColors.length];
            ctx.globalAlpha = glowAlpha; 
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 2 , 0, Math.PI * 2); 
            ctx.fill();
            ctx.restore(); // Restore context state (removes shadow, globalAlpha changes)
        }
        
        // Draw the main node (shadowBlur and shadowColor are reset by ctx.restore())
        ctx.fillStyle = outputColors[i % outputColors.length];
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
    
        if (probability > 0) {
            ctx.fillStyle = UI_COLORS.background; 
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(probability * 100)}%`, node.x, node.y);
        }
    });

    // Draw labels
    ctx.fillStyle = UI_COLORS.text;
    ctx.font = '8px monospace';
    inputNodes.forEach(node => {
        ctx.textAlign = 'right';
        ctx.fillText(node.label || '', node.x - 10, node.y + 3);
    });
    outputNodes.forEach(node => {
        ctx.textAlign = 'left';
        ctx.fillText(node.label || '', node.x + 10, node.y + 3);
    });

  }, [canvasWidth, canvasHeight]);


  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodePositionsRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentVitals: VitalSignsInput = {
        systolic: parseFloat(systolic as string),
        diastolic: parseFloat(diastolic as string),
        heartRate: parseFloat(heartRate as string),
        oxygenLevel: parseFloat(oxygenLevel as string),
        bodyTemperature: parseFloat(bodyTemperature as string),
        weatherTemperature: parseFloat(weatherTemperature as string),
        stepsCount: parseFloat(stepsCount as string),
    };

    const inputsNormalized = [
        (currentVitals.systolic - 60) / (250 - 60),
        (currentVitals.diastolic - 40) / (150 - 40),
        (currentVitals.heartRate - 30) / (200 - 30),
        (currentVitals.oxygenLevel - 70) / (100 - 70),
        (currentVitals.bodyTemperature - 32) / (45 - 32),
        (currentVitals.weatherTemperature - (-10)) / (50 - (-10)),
        (currentVitals.stepsCount - 0) / (20000 - 0)
    ].map(v => Math.max(0, Math.min(1, v || 0))); 

    const outputs = prediction?.probabilities ? 
        [prediction.probabilities.normal, prediction.probabilities.abnormal, prediction.probabilities.critical] 
        : [33, 33, 34]; 

    drawNetwork(ctx, inputsNormalized, outputs);

    particlesRef.current = particlesRef.current.filter(p => {
        p.update();
        p.draw(ctx);
        return !p.isDead();
    });
    
    if (animationPhase === 'processing' && Math.random() < 0.3 && nodePositionsRef.current) { 
        const { input: inputNodes, hidden: hiddenLayers } = nodePositionsRef.current;
        if (inputNodes.length > 0 && hiddenLayers.length > 0 && hiddenLayers[0].length > 0) {
            const randomInputNode = inputNodes[Math.floor(Math.random() * inputNodes.length)];
            const randomHiddenNode = hiddenLayers[0][Math.floor(Math.random() * hiddenLayers[0].length)];
            particlesRef.current.push(new Particle(
                randomInputNode.x, randomInputNode.y,
                randomHiddenNode.x, randomHiddenNode.y,
                Math.random(), 
                Math.random() > 0.5 ? UI_COLORS.primary : UI_COLORS.accent
            ));
        }
    }

    if (animationPhase !== 'idle' || particlesRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationPhase, prediction, systolic, diastolic, heartRate, oxygenLevel, bodyTemperature, weatherTemperature, stepsCount, drawNetwork]);


  useEffect(() => {
    // Ensure initial draw call happens after nodePositionsRef is likely set.
    // The animate function itself checks for nodePositionsRef.current.
    const initialAnimationId = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cancelAnimationFrame(initialAnimationId); // also cancel initial one if component unmounts quickly
    };
  }, [animate]); // Rerun effect if animate function reference changes


  const startAnimation = useCallback(() => {
    if (!nodePositionsRef.current) return;
    setAnimationPhase('processing');
    particlesRef.current = []; 
    
    const { input: inputNodes, hidden: hiddenLayers } = nodePositionsRef.current;
    if (inputNodes.length > 0 && hiddenLayers.length > 0 && hiddenLayers[0].length > 0) {
        inputNodes.forEach(inputNode => {
            let currentInputValue = 0;
            switch(inputNode.label) {
                case INPUT_LABELS[0]: currentInputValue = (parseFloat(systolic as string) - 60) / (250 - 60); break;
                case INPUT_LABELS[1]: currentInputValue = (parseFloat(diastolic as string) - 40) / (150 - 40); break;
                case INPUT_LABELS[2]: currentInputValue = (parseFloat(heartRate as string) - 30) / (200 - 30); break;
                case INPUT_LABELS[3]: currentInputValue = (parseFloat(oxygenLevel as string) - 70) / (100 - 70); break;
                case INPUT_LABELS[4]: currentInputValue = (parseFloat(bodyTemperature as string) - 32) / (45 - 32); break;
                case INPUT_LABELS[5]: currentInputValue = (parseFloat(weatherTemperature as string) - (-10)) / (50 - (-10)); break;
                case INPUT_LABELS[6]: currentInputValue = (parseFloat(stepsCount as string) - 0) / (20000 - 0); break;
            }
            currentInputValue = Math.max(0, Math.min(1, currentInputValue || 0));

            hiddenLayers[0].forEach(hiddenNode => {
                if (Math.random() < 0.25) { 
                     particlesRef.current.push(new Particle(
                        inputNode.x, inputNode.y,
                        hiddenNode.x, hiddenNode.y,
                        currentInputValue, 
                        UI_COLORS.primary
                    ));
                }
            });
        });
    }
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    // Directly call animate to ensure the loop starts with the new phase.
    // The animate function will then handle subsequent requestAnimationFrames.
    requestAnimationFrame(animate);
  }, [animate, systolic, diastolic, heartRate, oxygenLevel, bodyTemperature, weatherTemperature, stepsCount]);


  const handlePrediction = async () => {
    const vitals: VitalSignsInput = {
      systolic: parseFloat(systolic as string),
      diastolic: parseFloat(diastolic as string),
      heartRate: parseFloat(heartRate as string),
      oxygenLevel: parseFloat(oxygenLevel as string),
      bodyTemperature: parseFloat(bodyTemperature as string),
      weatherTemperature: parseFloat(weatherTemperature as string),
      stepsCount: parseFloat(stepsCount as string)
    };

    const errors = [];
    if (isNaN(vitals.systolic) || vitals.systolic < 50 || vitals.systolic > 300) errors.push('Systolic BP: 50-300 mmHg');
    if (isNaN(vitals.diastolic) || vitals.diastolic < 30 || vitals.diastolic > 200) errors.push('Diastolic BP: 30-200 mmHg');
    if (isNaN(vitals.heartRate) || vitals.heartRate < 20 || vitals.heartRate > 250) errors.push('Heart Rate: 20-250 BPM');
    if (isNaN(vitals.oxygenLevel) || vitals.oxygenLevel < 60 || vitals.oxygenLevel > 100) errors.push('Oxygen Level: 60-100%');
    if (isNaN(vitals.bodyTemperature) || vitals.bodyTemperature < 30 || vitals.bodyTemperature > 50) errors.push('Body Temp: 30-50°C');
    if (isNaN(vitals.weatherTemperature) || vitals.weatherTemperature < -50 || vitals.weatherTemperature > 60) errors.push('Weather Temp: -50-60°C');
    if (isNaN(vitals.stepsCount) || vitals.stepsCount < 0 || vitals.stepsCount > 50000) errors.push('Steps Count: 0-50,000');
    
    if (errors.length > 0) {
      setErrorMessage(`Invalid input(s): ${errors.join(', ')}.`);
      setAnimationPhase('idle'); 
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage('ANALYZING VITAL SIGNS...');
    setPrediction(null); 
    startAnimation();

    const result = await analyzeHealthWithGemini(vitals);

    if (result.success && result.analysis) {
      setPrediction(result.analysis);
      setStatusMessage(`ANALYSIS COMPLETE - STATUS: ${result.analysis.overallStatus.toUpperCase()}`);
      setAnimationPhase('complete');
    } else {
      setErrorMessage(result.message || 'Analysis failed. Please try again.');
      setStatusMessage('ANALYSIS FAILED');
      setAnimationPhase('idle'); 
    }
    setIsLoading(false);
  };
  
  // Returns a Tailwind background color class for vital status
  const getTailwindBgColorForStatus = (status?: string): string => {
    if (!status) return STATUS_BG_COLORS_TAILWIND.Default;
    // Normalize status: lowercase and remove spaces/special chars for robust matching
    const normalizedStatus = status.toLowerCase().replace(/[\s\(\)-]+/g, '');
    const foundKey = Object.keys(STATUS_BG_COLORS_TAILWIND).find(k => 
        k.toLowerCase().replace(/[\s\(\)-]+/g, '') === normalizedStatus
    );
    return foundKey ? STATUS_BG_COLORS_TAILWIND[foundKey as keyof typeof STATUS_BG_COLORS_TAILWIND] : STATUS_BG_COLORS_TAILWIND.Default;
  };

  // Returns a Tailwind text color class for risk level
  const getTailwindTextColorForRisk = (riskLevel?: string): string => {
    if (!riskLevel) return RISK_TEXT_COLORS_TAILWIND.Default;
    const key = Object.keys(RISK_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase() === riskLevel.toLowerCase());
    return key ? RISK_TEXT_COLORS_TAILWIND[key as keyof typeof RISK_TEXT_COLORS_TAILWIND] : RISK_TEXT_COLORS_TAILWIND.Default;
  };
  
  // Returns a Tailwind text color class for urgency
  const getTailwindTextColorForUrgency = (urgency?: string): string => {
    if (!urgency) return URGENCY_TEXT_COLORS_TAILWIND.Default;
    const normalizedUrgency = urgency.toLowerCase().replace(/\s+/g, ''); // Handle "Seek Care"
    const key = Object.keys(URGENCY_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase().replace(/\s+/g, '') === normalizedUrgency);
    return key ? URGENCY_TEXT_COLORS_TAILWIND[key as keyof typeof URGENCY_TEXT_COLORS_TAILWIND] : URGENCY_TEXT_COLORS_TAILWIND.Default;
  };

  // Helper to generate summary card classes with background opacity
  const getSummaryCardClasses = (colorClass: string): string => {
    if (colorClass.startsWith('text-')) {
      return `${colorClass.replace('text-', 'bg-')} bg-opacity-70`;
    }
    if (colorClass.startsWith('bg-')) {
        return `${colorClass} bg-opacity-70`;
    }
    return `${STATUS_BG_COLORS_TAILWIND.Default} bg-opacity-70`; // Fallback using corrected constant
  };

  const getRecommendationIcon = (type: RecommendationItem['type']): string => {
    switch (type) {
        case 'Lifestyle': return '🏃';
        case 'Dietary': return '🥗';
        case 'Consultation': return '🧑‍⚕️';
        case 'Monitoring': return '⏱️';
        case 'General': return '💡';
        default: return '💡';
    }
  };


  const renderVitalInput = (label: string, value: number | string, setter: (val: string) => void, unit: string, min: number, max: number, step?: number, ariaDescribedby?: string) => (
    <div className="flex-1 min-w-[150px]">
      <label htmlFor={`${label.toLowerCase().replace(/\s/g, '-')}-input`} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div className="flex items-center bg-slate-700 rounded-md shadow-sm">
        <input
          id={`${label.toLowerCase().replace(/\s/g, '-')}-input`}
          type="number"
          value={value}
          onChange={(e) => setter(e.target.value)}
          min={min}
          max={max}
          step={step || 1}
          disabled={isLoading}
          aria-label={`${label} input in ${unit}`}
          aria-describedby={ariaDescribedby}
          className="w-full p-2 bg-transparent border-none rounded-md text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          style={{ MozAppearance: 'textfield' }} 
        />
        <span className="px-3 text-slate-400 text-sm" aria-hidden="true">{unit}</span>
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
          className={`mt-2 text-sm ${isLoading ? 'text-yellow-400 animate-pulse' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {statusMessage}
        </p>
        {errorMessage && (
          <div 
            id="error-message-banner"
            className="mt-2 p-3 bg-red-700/50 text-red-300 border border-red-500 rounded-md text-sm"
            role="alert"
          >
            <span className="font-bold">⚠️ Error:</span> {errorMessage}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <section aria-labelledby="vitals-input-heading" className="bg-slate-700/50 p-6 rounded-lg shadow-lg">
          <h2 id="vitals-input-heading" className="text-xl font-semibold mb-4 text-cyan-400 border-b border-slate-600 pb-2">Vital Signs Input</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderVitalInput("Systolic BP", systolic, (v) => setSystolic(v), "mmHg", 50, 300, 1, "error-message-banner status-message")}
            {renderVitalInput("Diastolic BP", diastolic, (v) => setDiastolic(v), "mmHg", 30, 200, 1, "error-message-banner status-message")}
            {renderVitalInput("Heart Rate", heartRate, (v) => setHeartRate(v), "BPM", 20, 250, 1, "error-message-banner status-message")}
            {renderVitalInput("Oxygen Saturation", oxygenLevel, (v) => setOxygenLevel(v), "%", 60, 100, 0.1, "error-message-banner status-message")}
            {renderVitalInput("Body Temperature", bodyTemperature, (v) => setBodyTemperature(v), "°C", 30, 50, 0.1, "error-message-banner status-message")}
            {renderVitalInput("Weather Temperature", weatherTemperature, (v) => setWeatherTemperature(v), "°C", -50, 60, 0.1, "error-message-banner status-message")}
            {renderVitalInput("Daily Steps Count", stepsCount, (v) => setStepsCount(v), "steps", 0, 50000, 100, "error-message-banner status-message")}
          </div>
          <button
            onClick={handlePrediction}
            disabled={isLoading}
            aria-disabled={isLoading}
            aria-live="polite" 
            className={`mt-6 w-full py-3 px-4 font-semibold rounded-md transition-all duration-300 ease-in-out
                        ${isLoading ? 'bg-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:ring-4 focus:ring-cyan-400/50 transform hover:scale-105'}
                        text-white flex items-center justify-center space-x-2`}
          >
            {isLoading ? (
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

        <section aria-labelledby="visualization-heading" className="bg-slate-700/50 p-6 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[340px]"> {/* Increased min-h slightly for padding */}
          <h2 id="visualization-heading" className="text-xl font-semibold mb-2 text-pink-400 text-center">AI Processing Visualization</h2>
           <div 
              className="relative bg-slate-800 rounded-md overflow-hidden shadow-inner"
              style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }} // Apply dimensions using inline style
            >
            <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="absolute top-0 left-0" aria-label="Conceptual neural network animation" />
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-slate-300 capitalize" aria-live="polite">
                {animationPhase}
            </div>
          </div>
           <p className="text-xs text-slate-500 mt-2 text-center">Neural network activity (conceptual)</p>
        </section>
      </div>

       <section aria-labelledby="quick-presets-heading" className="mb-8 bg-slate-700/50 p-6 rounded-lg shadow-lg">
        <h3 id="quick-presets-heading" className="text-lg font-semibold text-slate-300 mb-3">Quick Test Scenarios</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Normal', color: 'green', vitals: { s: 120, d: 80, hr: 70, o2: 98, bt: 36.8, wt: 20, sc: 8000 } },
            { name: 'Slightly Elevated', color: 'yellow', vitals: { s: 145, d: 92, hr: 95, o2: 95, bt: 37.6, wt: 30, sc: 4000 } },
            { name: 'High Risk', color: 'orange', vitals: { s: 170, d: 105, hr: 115, o2: 91, bt: 38.5, wt: 5, sc: 1500 } },
            { name: 'Critical', color: 'red', vitals: { s: 190, d: 115, hr: 130, o2: 85, bt: 39.5, wt: 35, sc: 500 } },
          ].map(preset => (
            <button
              key={preset.name}
              onClick={() => {
                setSystolic(preset.vitals.s); setDiastolic(preset.vitals.d); setHeartRate(preset.vitals.hr);
                setOxygenLevel(preset.vitals.o2); setBodyTemperature(preset.vitals.bt);
                setWeatherTemperature(preset.vitals.wt); setStepsCount(preset.vitals.sc);
                setPrediction(null); 
                setAnimationPhase('idle'); 
                setStatusMessage('READY FOR ANALYSIS');
                setErrorMessage(null);
              }}
              disabled={isLoading}
              aria-disabled={isLoading}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 border-2
                          border-${preset.color}-500 text-${preset.color}-400 hover:bg-${preset.color}-500 hover:bg-opacity-30
                          disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-${preset.color}-400`}
            >
              {preset.name.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      {prediction && (
        <section aria-labelledby="results-heading" className="bg-slate-700/30 p-6 rounded-lg shadow-xl animate-fadeIn" role="region">
          <h2 id="results-heading" className="text-2xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-teal-400 to-sky-400">
            AI Health Analysis Results
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
            <div className={`p-4 rounded-lg shadow ${getSummaryCardClasses(getTailwindBgColorForStatus(prediction.overallStatus))}`}>
              <div className="text-sm font-medium text-white/80">OVERALL STATUS</div>
              <div className="text-2xl font-bold text-white">{prediction.overallStatus.toUpperCase()}</div>
            </div>
            <div className={`p-4 rounded-lg shadow ${getSummaryCardClasses(getTailwindTextColorForRisk(prediction.riskLevel))}`}>
              <div className="text-sm font-medium text-white/80">RISK LEVEL</div>
              <div className={`text-2xl font-bold ${getTailwindTextColorForRisk(prediction.riskLevel)}`}>{prediction.riskLevel.toUpperCase()}</div>
            </div>
             <div className={`p-4 rounded-lg shadow ${getSummaryCardClasses(getTailwindTextColorForUrgency(prediction.urgency))}`}>
              <div className="text-sm font-medium text-white/80">URGENCY</div>
              <div className={`text-2xl font-bold ${getTailwindTextColorForUrgency(prediction.urgency)}`}>{prediction.urgency.toUpperCase()}</div>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-slate-700 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Confidence & Probabilities</h3>
            <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                <div className="text-center">
                    <div className="text-3xl font-bold text-cyan-400">{prediction.confidence}%</div>
                    <div className="text-sm text-slate-400">Confidence</div>
                </div>
                <div className="flex space-x-2 sm:space-x-4">
                    {Object.entries(prediction.probabilities).map(([key, value]) => (
                    <div key={key} className="text-center p-2 rounded-md bg-slate-600/50 min-w-[70px]">
                        <div className={`text-xl sm:text-2xl font-semibold ${key === 'normal' ? 'text-green-400' : key === 'abnormal' ? 'text-yellow-400' : 'text-red-500'}`}>{value}%</div>
                        <div className="text-xs text-slate-500 capitalize">{key}</div>
                    </div>
                    ))}
                </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-200 mb-3">Detailed Vital Signs Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(prediction.vitalAnalysis).map(([vitalKey, analysis]) => {
                const typedAnalysis = analysis as VitalAnalysisDetail; 
                if (!typedAnalysis || !typedAnalysis.status || !typedAnalysis.concern) return null; 
                
                const baseBgColor = getTailwindBgColorForStatus(typedAnalysis.status);
                const statusTextColorKey = Object.keys(STATUS_TEXT_COLORS_TAILWIND).find(k => k.toLowerCase().replace(/[\s\(\)-]+/g, '') === typedAnalysis.status.toLowerCase().replace(/[\s\(\)-]+/g, '')) as keyof typeof STATUS_TEXT_COLORS_TAILWIND;
                const statusTextColor = statusTextColorKey ? STATUS_TEXT_COLORS_TAILWIND[statusTextColorKey] : STATUS_TEXT_COLORS_TAILWIND.Default;


                return (
                <div key={vitalKey} className={`p-4 rounded-lg shadow-md ${baseBgColor} bg-opacity-30 border ${baseBgColor.replace('bg-', 'border-')} border-opacity-50`}>
                  <h4 className={`font-semibold capitalize text-white opacity-90`}>{vitalKey.replace(/([A-Z](?=[a-z]))|([A-Z]+(?=[A-Z][a-z]))/g, ' $1$2').trim()} {typedAnalysis.value ? `(${typedAnalysis.value})` : ''}</h4>
                  <p className={`text-lg font-bold ${statusTextColor}`}>{typedAnalysis.status.toUpperCase()}</p>
                  <p className={`text-sm mt-1 text-white opacity-80`}>{typedAnalysis.concern}</p>
                </div>
              )})}
            </div>
          </div>

          {prediction.keyFindings && prediction.keyFindings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Key Clinical Findings</h3>
              <ul className="space-y-2">
                {prediction.keyFindings.map((finding, index) => (
                  <li key={index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-cyan-400 mr-3 text-xl" aria-hidden="true">🔍</span>
                    <span className="text-slate-300">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prediction.recommendations && prediction.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {prediction.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-pink-400 mr-3 text-xl" aria-hidden="true">{getRecommendationIcon(rec.type)}</span>
                    <div>
                        <strong className="text-pink-300 capitalize">{rec.type}: </strong>
                        <span className="text-slate-300">{rec.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prediction.preventiveMeasures && prediction.preventiveMeasures.length > 0 && (
            <div> {/* Removed mb-6 if it's the last section before disclaimer */}
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Preventive Measures</h3>
              <ul className="space-y-2">
                {prediction.preventiveMeasures.map((measure, index) => (
                  <li key={index} className="flex items-start p-3 bg-slate-700/70 rounded-md">
                    <span className="text-teal-400 mr-3 text-xl" aria-hidden="true">🛡️</span>
                    <span className="text-slate-300">{measure}</span>
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
        /* Tailwind JIT compatibility ensured by using standard opacity classes like bg-opacity-XX */
        /* Explicit color definitions for reference or specific fallbacks */
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

        .bg-opacity-30 { --tw-bg-opacity: 0.3 !important; } /* Ensure opacity applies */
        .bg-opacity-50 { --tw-bg-opacity: 0.5 !important; }
        .bg-opacity-70 { --tw-bg-opacity: 0.7 !important; }
        .border-opacity-50 { --tw-border-opacity: 0.5 !important; }

        .bg-slate-700\\/30 { background-color: rgba(51, 65, 85, 0.3); } /* custom class for bg-slate-700/30 */
        .bg-slate-700\\/50 { background-color: rgba(51, 65, 85, 0.5); }
        .bg-slate-700\\/70 { background-color: rgba(51, 65, 85, 0.7); }
        .bg-red-700\\/50 { background-color: rgba(185, 28, 28, 0.5); }
        .bg-yellow-500\\/10 { background-color: rgba(234, 179, 8, 0.1); }


      `}</style>
    </div>
  );
};

export default HealthPredictor;
