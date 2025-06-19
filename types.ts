
export interface VitalSignsInput { systolic: number; diastolic: number; heartRate: number; oxygenLevel: number; bodyTemperature: number; weatherTemperature: number; stepsCount: number;
} export interface VitalAnalysisDetail { status: string; concern: string; value?: string;
} export interface RecommendationItem { type: 'Lifestyle' | 'Dietary' | 'Consultation' | 'Monitoring' | 'General'; text: string;
} export interface AIPrediction { overallStatus: 'Normal' | 'Warning' | 'Critical' | string; riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | string; confidence: number; probabilities: { normal: number; abnormal: number; critical: number; }; vitalAnalysis: { bloodPressure: VitalAnalysisDetail; heartRate: VitalAnalysisDetail; oxygenSaturation: VitalAnalysisDetail; bodyTemperature: VitalAnalysisDetail; weatherImpact: VitalAnalysisDetail & { value: string }; activityLevel: VitalAnalysisDetail & { value: string }; [key: string]: VitalAnalysisDetail | undefined; }; keyFindings: string[]; recommendations: RecommendationItem[]; preventiveMeasures: string[]; urgency: 'Routine' | 'Monitor' | 'Seek Care' | 'Emergency' | string;
} export interface ParticleState { startX: number; startY: number; endX: number; endY: number; x: number; y: number; progress: number; speed: number; size: number; color: string; life: number; update: () => void; draw: (ctx: CanvasRenderingContext2D) => void; isDead: () => boolean;
} export interface NodePosition { x: number; y: number; value: number; label?: string; activation?: number;
}
