const express = require("express"),
  cors = require("cors"),
  fs = require("fs"),
  path = require("path"),
  bodyParser = require("body-parser"),
  brain = require("brainjs"),
  app = express(),
  PORT = process.env.PORT || 5e3;
app.use(cors()),
  app.use(bodyParser.json({ limit: "50mb" })),
  fs.existsSync(path.join(__dirname, "dist")) &&
    app.use(express.static(path.join(__dirname, "dist")));
const csvFilePath = path.join(__dirname, "health_data.csv"),
  modelFilePath = path.join(__dirname, "health_model.json"),
  trainingJobs = {},
  log = (e, t = "info") => {
    new Date().toISOString();
  },
  ensureCSVExists = () => {
    if (!fs.existsSync(csvFilePath)) {
      const e = [
        "ID",
        "Timestamp",
        "Systolic BP (mmHg)",
        "Diastolic BP (mmHg)",
        "BP Status",
        "Heart Rate (bpm)",
        "HR Status",
        "Oxygen Level (%)",
        "O2 Status",
        "Temperature (°C)",
        "Temp Status",
      ];
      fs.writeFileSync(csvFilePath, e.join(",") + "\n"), log(0, "info");
    }
  };
ensureCSVExists();
const parseCSV = (e) => {
    const t = e.split("\n").filter((e) => e.trim()),
      a = t[0]
        .split(",")
        .map((e) =>
          e
            .trim()
            .replace("Systolic BP (mmHg)", "systolic")
            .replace("Diastolic BP (mmHg)", "diastolic")
            .replace("BP Status", "bloodPressureStatus")
            .replace("Heart Rate (bpm)", "heartRate")
            .replace("HR Status", "heartRateStatus")
            .replace("Oxygen Level (%)", "oxygenLevel")
            .replace("O2 Status", "oxygenLevelStatus")
            .replace("Temperature (°C)", "temperature")
            .replace("Temp Status", "temperatureStatus")
        ),
      r = [];
    for (let e = 1; e < t.length; e++) {
      const i = t[e].trim();
      if (!i) continue;
      const s = [];
      let n = !1,
        o = "";
      for (let e = 0; e < i.length; e++) {
        const t = i[e];
        '"' === t
          ? (n = !n)
          : "," !== t || n
          ? (o += t)
          : (s.push(o), (o = ""));
      }
      s.push(o);
      const c = {};
      for (let e = 0; e < a.length; e++) {
        const t = a[e],
          r = s[e] ? s[e].trim() : "";
        ["systolic", "diastolic", "heartRate"].includes(t)
          ? (c[t] = parseInt(r, 10))
          : ["oxygenLevel", "temperature"].includes(t)
          ? (c[t] = parseFloat(r))
          : (c[t] = r);
      }
      r.push(c);
    }
    return r;
  },
  safeToISOString = (e) => {
    if (!e) return null;
    try {
      return isNaN(e.getTime()) ? null : e.toISOString();
    } catch (e) {
      return log(e.message, "error"), null;
    }
  },
  getDataStats = () => {
    if (!fs.existsSync(csvFilePath))
      return { totalRecords: 0, dateRange: { from: null, to: null } };
    try {
      const e = fs.readFileSync(csvFilePath, "utf8"),
        t = e.split("\n").filter((e) => e.trim()),
        a = Math.max(0, t.length - 1);
      let r = null,
        i = null;
      if (a > 0) {
        parseCSV(e).forEach((e) => {
          try {
            if (e.timestamp) {
              const t = new Date(e.timestamp);
              isNaN(t.getTime()) ||
                ((!r || t < r) && (r = t), (!i || t > i) && (i = t));
            }
          } catch (t) {
            log(e.id, "warn");
          }
        });
      }
      return {
        totalRecords: a,
        dateRange: { from: safeToISOString(r), to: safeToISOString(i) },
      };
    } catch (e) {
      return (
        log(e.message, "error"),
        {
          totalRecords: 0,
          dateRange: { from: null, to: null },
          error: e.message,
        }
      );
    }
  },
  normalizeData = (e, t, a) => (e - t) / (a - t),
  prepareTrainingData = (e) => {
    if (!e || !e.length) return [];
    const t = { min: 90, max: 200 },
      a = { min: 60, max: 120 },
      r = { min: 60, max: 180 },
      i = { min: 70, max: 100 },
      s = { min: 36, max: 41 };
    return e.map((e) => ({
      input: {
        systolic: normalizeData(e.systolic, t.min, t.max),
        diastolic: normalizeData(e.diastolic, a.min, a.max),
        heartRate: normalizeData(e.heartRate, r.min, r.max),
        oxygenLevel: normalizeData(e.oxygenLevel, i.min, i.max),
        temperature: normalizeData(e.temperature, s.min, s.max),
      },
      output: {
        normal:
          "normal" === e.bloodPressureStatus &&
          "normal" === e.heartRateStatus &&
          "normal" === e.oxygenLevelStatus &&
          "normal" === e.temperatureStatus
            ? 1
            : 0,
        abnormal:
          ("abnormal" !== e.bloodPressureStatus &&
            "abnormal" !== e.heartRateStatus &&
            "abnormal" !== e.oxygenLevelStatus &&
            "abnormal" !== e.temperatureStatus) ||
          "critical" === e.bloodPressureStatus ||
          "critical" === e.heartRateStatus ||
          "critical" === e.oxygenLevelStatus ||
          "critical" === e.temperatureStatus
            ? 0
            : 1,
        critical:
          "critical" === e.bloodPressureStatus ||
          "critical" === e.heartRateStatus ||
          "critical" === e.oxygenLevelStatus ||
          "critical" === e.temperatureStatus
            ? 1
            : 0,
      },
    }));
  };
class KNNModel {
  constructor(e = 5, t = "euclidean") {
    (this.k = e), (this.distanceMetric = t), (this.trainingData = []);
  }
  train(e) {
    return (this.trainingData = e), { iterations: 1, error: 0 };
  }
  calculateDistance(e, t) {
    return "euclidean" === this.distanceMetric
      ? Math.sqrt(
          Object.keys(e).reduce((a, r) => a + Math.pow(e[r] - t[r], 2), 0)
        )
      : "manhattan" === this.distanceMetric
      ? Object.keys(e).reduce((a, r) => a + Math.abs(e[r] - t[r]), 0)
      : Math.sqrt(
          Object.keys(e).reduce((a, r) => a + Math.pow(e[r] - t[r], 2), 0)
        );
  }
  run(e) {
    const t = this.trainingData.map((t) => ({
      distance: this.calculateDistance(e, t.input),
      output: t.output,
    }));
    t.sort((e, t) => e.distance - t.distance);
    const a = t.slice(0, this.k),
      r = { normal: 0, abnormal: 0, critical: 0 };
    a.forEach((e) => {
      const t = Object.keys(e.output).reduce((t, a) =>
        e.output[t] > e.output[a] ? t : a
      );
      r[t]++;
    });
    const i = this.k;
    return {
      normal: r.normal / i,
      abnormal: r.abnormal / i,
      critical: r.critical / i,
    };
  }
  toJSON() {
    return {
      k: this.k,
      distanceMetric: this.distanceMetric,
      trainingData: this.trainingData,
    };
  }
  fromJSON(e) {
    (this.k = e.k),
      (this.distanceMetric = e.distanceMetric),
      (this.trainingData = e.trainingData);
  }
}
const trainModel = async (e, t, a, r = 0) => {
    const i = (t, a, r = {}) => {
      (trainingJobs[e] = {
        ...trainingJobs[e],
        progress: Math.min(100, Math.max(0, t)),
        currentStep: a,
        ...r,
      }),
        log(0, "info");
    };
    try {
      if (
        (i(5, "Initializing enhanced training environment..."),
        !fs.existsSync(csvFilePath))
      )
        throw new Error("No health data available for training");
      i(10, "Loading realistic health dataset...");
      const r = fs.readFileSync(csvFilePath, "utf8"),
        s = parseCSV(r),
        n = s.length;
      if (0 === n) throw new Error("No health data records found");
      log(0, "info"),
        i(15, `Loaded ${n.toLocaleString()} realistic records`),
        i(18, "Analyzing medical correlations and data quality...");
      const o = calculateVitalSignCorrelations(
        s.slice(0, Math.min(5e3, s.length))
      );
      let c, l, u, m;
      if (
        (log(o.qualityScore.toFixed(2), "info"),
        "knn" === t && a.sampleSize && a.sampleSize < n)
      )
        i(20, "Intelligent sampling for KNN training..."),
          (c = stratifiedSample(s, a.sampleSize)),
          log(c.length, "info");
      else if ("ensemble" === t) {
        i(20, "Preparing data for ensemble training...");
        const e = Math.min(5e4, n),
          t = a.knn?.sampleSize || 1e4;
        (c = {
          neuralNetwork: stratifiedSample(s, e),
          knn: stratifiedSample(s, t),
        }),
          log(0, "info");
      } else (c = s), log(0, "info");
      if (
        (i(25, "Preprocessing and normalizing medical data..."),
        (l =
          "ensemble" === t
            ? {
                neuralNetwork: prepareEnhancedTrainingData(c.neuralNetwork),
                knn: prepareEnhancedTrainingData(c.knn),
              }
            : prepareEnhancedTrainingData(Array.isArray(c) ? c : s)),
        (Array.isArray(l) && 0 === l.length) ||
          (l.neuralNetwork && 0 === l.neuralNetwork.length))
      )
        throw new Error("No valid training data after preprocessing");
      if (
        (i(30, "Initializing enhanced machine learning model..."),
        "neural-network" === t)
      ) {
        log(0, "info"),
          log(JSON.stringify(a, null, 2), "info"),
          (u = new brain.NeuralNetwork({
            hiddenLayers: a.hiddenLayers || [32, 16, 8],
            activation: "sigmoid",
            learningRate: a.learningRate || 0.005,
            momentum: a.momentum || 0.9,
            regularization: a.regularization || 0.001,
          })),
          i(35, "Starting enhanced neural network training...");
        const e = a.iterations || 2e3,
          t = a.errorThreshold || 0.003,
          r = a.validationSplit || 0.2,
          s = Math.floor(l.length * (1 - r)),
          n = l.slice(0, s),
          o = l.slice(s);
        let c = Date.now(),
          g = 1 / 0,
          d = 0;
        const h = 100;
        (m = u.train(n, {
          iterations: e,
          errorThresh: t,
          log: !0,
          logPeriod: Math.max(1, Math.floor(e / 200)),
          momentum: a.momentum || 0.9,
          callback: (t) => {
            const a = Math.min(85, 35 + Math.floor((t.iterations / e) * 50)),
              r = Date.now();
            let s = 0;
            if (
              (o.length > 0 &&
                t.iterations % 50 == 0 &&
                ((s = calculateValidationError(u, o)),
                s < g ? ((g = s), (d = 0)) : d++),
              r - c > 500 &&
                (i(
                  a,
                  `Training iteration ${
                    t.iterations
                  }/${e} (Val Error: ${s.toFixed(6)})`,
                  {
                    currentIteration: t.iterations,
                    currentError: t.error,
                    validationError: s,
                    targetIterations: e,
                    accuracy: calculateCurrentAccuracy(u, o),
                  }
                ),
                (c = r)),
              log((t.iterations, t.error.toFixed(6), s.toFixed(6)), "debug"),
              d >= h)
            )
              return log(t.iterations, "info"), !0;
          },
        })),
          log(m.error, "success");
      } else if ("knn" === t) {
        log(0, "info"),
          log(JSON.stringify(a, null, 2), "info"),
          (u = new EnhancedKNNModel(
            a.k || 7,
            a.distanceMetric || "euclidean",
            !1 !== a.weightedVoting,
            a.featureWeighting
          )),
          i(40, "Training enhanced KNN model...");
        const e = [50, 60, 70, 80, 85];
        for (let t = 0; t < e.length; t++)
          await new Promise((e) => setTimeout(e, 300)),
            i(
              e[t],
              `Processing enhanced KNN training data... (${t + 1}/${e.length})`
            );
        (m = u.train(l)), log(0, "success");
      } else {
        if ("ensemble" !== t)
          throw new Error(`Unsupported training method: ${t}`);
        {
          log(0, "info"),
            log(JSON.stringify(a, null, 2), "info"),
            i(35, "Training ensemble: Neural Network component...");
          const e = new brain.NeuralNetwork({
              hiddenLayers: a.neuralNetwork?.hiddenLayers || [24, 12],
              activation: "sigmoid",
              learningRate: a.neuralNetwork?.learningRate || 0.008,
            }),
            t = e.train(l.neuralNetwork, {
              iterations: a.neuralNetwork?.iterations || 1500,
              errorThresh: a.neuralNetwork?.errorThreshold || 0.005,
              log: !1,
            });
          i(60, "Training ensemble: KNN component...");
          const r = new EnhancedKNNModel(
              a.knn?.k || 5,
              a.knn?.distanceMetric || "euclidean",
              !0
            ),
            s = r.train(l.knn);
          i(75, "Combining ensemble models..."),
            (u = new EnsembleModel(e, r, a.ensembleWeights)),
            (m = {
              iterations: t.iterations,
              error: (t.error + s.error) / 2,
              neuralNetworkError: t.error,
              knnError: s.error,
            }),
            log(0, "success");
        }
      }
      i(88, "Evaluating enhanced model performance...");
      const g = Math.max(
          200,
          Math.floor(
            0.15 * (Array.isArray(l) ? l.length : l.neuralNetwork.length)
          )
        ),
        d = Array.isArray(l) ? l.slice(0, g) : l.neuralNetwork.slice(0, g),
        h = calculateEnhancedPerformanceMetrics(u, d);
      log(h.accuracy.toFixed(2), "success"),
        log(JSON.stringify(h.classAccuracies), "info"),
        log(h.medicalCorrelationScore.toFixed(2), "info"),
        i(95, "Saving enhanced trained model...");
      const p = {
        modelJson: u.toJSON(),
        method: t,
        recordCount: Array.isArray(c) ? c.length : c.neuralNetwork?.length || n,
        iterations: m.iterations,
        error: m.error,
        accuracy: h.accuracy,
        classAccuracies: h.classAccuracies,
        medicalCorrelationScore: h.medicalCorrelationScore,
        confusionMatrix: h.confusionMatrix,
        config: a,
        dataQuality: o.qualityScore,
        timestamp: new Date().toISOString(),
        trainingDuration: Date.now() - trainingJobs[e].startTime,
        enhancedFeatures: {
          validationSplit: a.validationSplit,
          regularization: a.regularization,
          dropout: a.dropout,
          momentum: a.momentum,
          weightedVoting: a.weightedVoting,
          featureWeighting: a.featureWeighting,
        },
      };
      fs.writeFileSync(modelFilePath, JSON.stringify(p, null, 2)),
        log(0, "success"),
        i(100, "Enhanced training completed successfully!", {
          completed: !0,
          success: !0,
          recordCount: p.recordCount,
          iterations: m.iterations,
          error: m.error,
          accuracy: h.accuracy,
          classAccuracies: h.classAccuracies,
          medicalCorrelationScore: h.medicalCorrelationScore,
          method: t,
          timestamp: p.timestamp,
          trainingDuration: p.trainingDuration,
          config: a,
        }),
        log(0, "success");
    } catch (t) {
      log(t.message, "error"),
        (trainingJobs[e] = {
          ...trainingJobs[e],
          completed: !0,
          success: !1,
          error: t.message,
          currentStep: "Enhanced training failed",
        });
    }
  },
  prepareEnhancedTrainingData = (e) => {
    if (!e || !e.length) return [];
    const t = { min: 60, max: 250 },
      a = { min: 40, max: 150 },
      r = { min: 30, max: 200 },
      i = { min: 70, max: 100 },
      s = { min: 32, max: 45 };
    return e.map((e) => {
      const n = {
          systolic: normalizeData(e.systolic, t.min, t.max),
          diastolic: normalizeData(e.diastolic, a.min, a.max),
          heartRate: normalizeData(e.heartRate, r.min, r.max),
          oxygenLevel: normalizeData(e.oxygenLevel, i.min, i.max),
          temperature: normalizeData(e.temperature, s.min, s.max),
        },
        o =
          "critical" === e.bloodPressureStatus ||
          "critical" === e.heartRateStatus ||
          "critical" === e.oxygenLevelStatus ||
          "critical" === e.temperatureStatus,
        c =
          !o &&
          ("abnormal" === e.bloodPressureStatus ||
            "abnormal" === e.heartRateStatus ||
            "abnormal" === e.oxygenLevelStatus ||
            "abnormal" === e.temperatureStatus);
      return {
        input: n,
        output: {
          normal: !o && !c ? 1 : 0,
          abnormal: c ? 1 : 0,
          critical: o ? 1 : 0,
        },
      };
    });
  },
  generateEnhancedMedicalAnalysis = (e, t, a) => {
    const r = [],
      i = [],
      s = [];
    e.systolic > 180 || e.diastolic > 110
      ? (r.push({
          type: "critical",
          category: "Blood Pressure",
          finding: "HYPERTENSIVE CRISIS",
          description: `Systolic: ${e.systolic} mmHg, Diastolic: ${e.diastolic} mmHg`,
          severity: "CRITICAL",
        }),
        i.push("Immediate medical attention required for hypertensive crisis"))
      : e.systolic > 140 || e.diastolic > 90
      ? (r.push({
          type: "warning",
          category: "Blood Pressure",
          finding: "HYPERTENSION",
          description: `Systolic: ${e.systolic} mmHg, Diastolic: ${e.diastolic} mmHg`,
          severity: "ABNORMAL",
        }),
        i.push(
          "Monitor blood pressure regularly and consider lifestyle modifications"
        ))
      : e.systolic < 90 &&
        r.push({
          type: "warning",
          category: "Blood Pressure",
          finding: "HYPOTENSION",
          description: `Systolic: ${e.systolic} mmHg may indicate low blood pressure`,
          severity: "ABNORMAL",
        }),
      e.heartRate > 120
        ? (r.push({
            type: "warning",
            category: "Heart Rate",
            finding: "SEVERE TACHYCARDIA",
            description: `Heart rate: ${e.heartRate} BPM is significantly elevated`,
            severity: e.heartRate > 150 ? "CRITICAL" : "ABNORMAL",
          }),
          i.push("Evaluate for underlying cardiac or systemic causes"))
        : e.heartRate > 100
        ? r.push({
            type: "warning",
            category: "Heart Rate",
            finding: "TACHYCARDIA",
            description: `Heart rate: ${e.heartRate} BPM is elevated`,
            severity: "ABNORMAL",
          })
        : e.heartRate < 50 &&
          r.push({
            type: "warning",
            category: "Heart Rate",
            finding: "BRADYCARDIA",
            description: `Heart rate: ${e.heartRate} BPM is below normal range`,
            severity: e.heartRate < 40 ? "CRITICAL" : "ABNORMAL",
          }),
      e.oxygenLevel < 88
        ? (r.push({
            type: "critical",
            category: "Oxygen Saturation",
            finding: "SEVERE HYPOXEMIA",
            description: `Oxygen saturation: ${e.oxygenLevel}% indicates severe oxygen deficiency`,
            severity: "CRITICAL",
          }),
          i.push(
            "Immediate oxygen therapy and respiratory assessment required"
          ))
        : e.oxygenLevel < 95 &&
          (r.push({
            type: "warning",
            category: "Oxygen Saturation",
            finding: "HYPOXEMIA",
            description: `Oxygen saturation: ${e.oxygenLevel}% is below normal range`,
            severity: "ABNORMAL",
          }),
          i.push(
            "Monitor respiratory status and consider supplemental oxygen"
          )),
      e.temperature > 40
        ? (r.push({
            type: "critical",
            category: "Temperature",
            finding: "HYPERTHERMIA",
            description: `Temperature: ${e.temperature}°C indicates severe fever`,
            severity: "CRITICAL",
          }),
          i.push("Immediate cooling measures and fever management required"))
        : e.temperature > 38
        ? (r.push({
            type: "warning",
            category: "Temperature",
            finding: "FEVER",
            description: `Temperature: ${e.temperature}°C indicates fever`,
            severity: "ABNORMAL",
          }),
          i.push("Monitor temperature and consider antipyretic therapy"))
        : e.temperature < 35 &&
          (r.push({
            type: "critical",
            category: "Temperature",
            finding: "HYPOTHERMIA",
            description: `Temperature: ${e.temperature}°C is dangerously low`,
            severity: "CRITICAL",
          }),
          i.push("Immediate warming measures required"));
    const n = e.systolic > 140 || e.diastolic > 90,
      o = e.heartRate > 100,
      c = e.oxygenLevel < 95,
      l = e.temperature > 38;
    let u;
    return (
      n &&
        o &&
        s.push({
          type: "correlation",
          finding: "HYPERTENSION + TACHYCARDIA",
          description:
            "Elevated blood pressure with increased heart rate may indicate cardiovascular stress",
          clinicalSignificance:
            "Consider cardiac evaluation and stress assessment",
        }),
      c &&
        o &&
        s.push({
          type: "correlation",
          finding: "HYPOXEMIA + TACHYCARDIA",
          description:
            "Low oxygen with increased heart rate suggests compensatory response",
          clinicalSignificance:
            "Evaluate respiratory function and oxygen delivery",
        }),
      l &&
        o &&
        s.push({
          type: "correlation",
          finding: "FEVER + TACHYCARDIA",
          description:
            "Fever with increased heart rate is a normal physiological response",
          clinicalSignificance:
            "Monitor for signs of sepsis or systemic infection",
        }),
      (u =
        "critical" === a
          ? {
              status: "CRITICAL",
              priority: "IMMEDIATE ATTENTION REQUIRED",
              description:
                "Multiple vital signs indicate a critical condition requiring immediate medical intervention",
              confidence: `Model confidence: ${t.critical}%`,
            }
          : "abnormal" === a
          ? {
              status: "ABNORMAL",
              priority: "MEDICAL EVALUATION RECOMMENDED",
              description:
                "One or more vital signs are outside normal ranges and require medical attention",
              confidence: `Model confidence: ${t.abnormal}%`,
            }
          : {
              status: "NORMAL",
              priority: "ROUTINE MONITORING",
              description: "All vital signs are within acceptable ranges",
              confidence: `Model confidence: ${t.normal}%`,
            }),
      0 === r.length &&
        r.push({
          type: "normal",
          category: "Overall Assessment",
          finding: "ALL VITAL SIGNS NORMAL",
          description:
            "Blood pressure, heart rate, oxygen saturation, and temperature are within normal limits",
          severity: "NORMAL",
        }),
      {
        findings: r,
        correlations: s,
        recommendations: i,
        overallAssessment: u,
        disclaimer:
          "This analysis is for educational purposes only and should not replace professional medical evaluation",
      }
    );
  };
class EnhancedKNNModel {
  constructor(e = 7, t = "euclidean", a = !0, r = null) {
    (this.k = e),
      (this.distanceMetric = t),
      (this.weightedVoting = a),
      (this.featureWeighting = r || {
        systolic: 1.2,
        diastolic: 1.1,
        heartRate: 1,
        oxygenLevel: 1.3,
        temperature: 0.9,
      }),
      (this.trainingData = []);
  }
  train(e) {
    return (this.trainingData = e), { iterations: 1, error: 0 };
  }
  calculateDistance(e, t) {
    const a = [
      "systolic",
      "diastolic",
      "heartRate",
      "oxygenLevel",
      "temperature",
    ];
    return "euclidean" === this.distanceMetric
      ? Math.sqrt(
          a.reduce((a, r) => {
            const i = this.featureWeighting[r] || 1,
              s = e[r] - t[r];
            return a + i * s * s;
          }, 0)
        )
      : "manhattan" === this.distanceMetric
      ? a.reduce(
          (a, r) => a + (this.featureWeighting[r] || 1) * Math.abs(e[r] - t[r]),
          0
        )
      : Math.sqrt(
          a.reduce((a, r) => {
            const i = this.featureWeighting[r] || 1,
              s = e[r] - t[r];
            return a + i * s * s;
          }, 0)
        );
  }
  run(e) {
    const t = this.trainingData.map((t) => ({
      distance: this.calculateDistance(e, t.input),
      output: t.output,
    }));
    t.sort((e, t) => e.distance - t.distance);
    const a = t.slice(0, this.k);
    if (this.weightedVoting) {
      const e = a.map((e) => (0 === e.distance ? 1 : 1 / (e.distance + 1e-8))),
        t = e.reduce((e, t) => e + t, 0),
        r = { normal: 0, abnormal: 0, critical: 0 };
      return (
        a.forEach((a, i) => {
          const s = e[i] / t;
          Object.keys(r).forEach((e) => {
            r[e] += a.output[e] * s;
          });
        }),
        r
      );
    }
    {
      const e = { normal: 0, abnormal: 0, critical: 0 };
      a.forEach((t) => {
        const a = Object.keys(t.output).reduce((e, a) =>
          t.output[e] > t.output[a] ? e : a
        );
        e[a]++;
      });
      const t = this.k;
      return {
        normal: e.normal / t,
        abnormal: e.abnormal / t,
        critical: e.critical / t,
      };
    }
  }
  toJSON() {
    return {
      k: this.k,
      distanceMetric: this.distanceMetric,
      weightedVoting: this.weightedVoting,
      featureWeighting: this.featureWeighting,
      trainingData: this.trainingData,
    };
  }
  fromJSON(e) {
    (this.k = e.k),
      (this.distanceMetric = e.distanceMetric),
      (this.weightedVoting = e.weightedVoting),
      (this.featureWeighting = e.featureWeighting),
      (this.trainingData = e.trainingData);
  }
}
class EnsembleModel {
  constructor(e, t, a = { neuralNetwork: 0.7, knn: 0.3 }) {
    (this.neuralNetwork = e), (this.knnModel = t), (this.weights = a);
  }
  run(e) {
    const t = this.neuralNetwork.run(e),
      a = this.knnModel.run(e);
    return {
      normal:
        t.normal * this.weights.neuralNetwork + a.normal * this.weights.knn,
      abnormal:
        t.abnormal * this.weights.neuralNetwork + a.abnormal * this.weights.knn,
      critical:
        t.critical * this.weights.neuralNetwork + a.critical * this.weights.knn,
    };
  }
  toJSON() {
    return {
      type: "ensemble",
      neuralNetwork: this.neuralNetwork.toJSON(),
      knnModel: this.knnModel.toJSON(),
      weights: this.weights,
    };
  }
  fromJSON(e) {
    this.weights = e.weights;
  }
}
const calculateEnhancedPerformanceMetrics = (e, t) => {
    let a = 0,
      r = {
        normal: {
          correct: 0,
          total: 0,
          truePositives: 0,
          falsePositives: 0,
          falseNegatives: 0,
        },
        abnormal: {
          correct: 0,
          total: 0,
          truePositives: 0,
          falsePositives: 0,
          falseNegatives: 0,
        },
        critical: {
          correct: 0,
          total: 0,
          truePositives: 0,
          falsePositives: 0,
          falseNegatives: 0,
        },
      },
      i = {
        normal: { normal: 0, abnormal: 0, critical: 0 },
        abnormal: { normal: 0, abnormal: 0, critical: 0 },
        critical: { normal: 0, abnormal: 0, critical: 0 },
      },
      s = 0,
      n = 0;
    t.forEach((t) => {
      const o = e.run(t.input),
        c = Object.keys(t.output).reduce((e, a) =>
          t.output[e] > t.output[a] ? e : a
        ),
        l = Object.keys(o).reduce((e, t) => (o[e] > o[t] ? e : t));
      i[c][l]++,
        r[c].total++,
        c === l
          ? (a++, r[c].correct++, r[c].truePositives++)
          : (r[c].falseNegatives++, r[l].falsePositives++),
        (("critical" === c && o.critical > 0.7) ||
          ("normal" === c && o.normal > 0.6) ||
          ("abnormal" === c && o.abnormal > 0.4)) &&
          s++,
        n++;
    });
    const o = (a / t.length) * 100,
      c = (s / n) * 100,
      l = {},
      u = {},
      m = {};
    return (
      Object.keys(r).forEach((e) => {
        const t = r[e];
        (l[e] = t.total > 0 ? (t.correct / t.total) * 100 : 0),
          (u[e] =
            t.truePositives + t.falsePositives > 0
              ? (t.truePositives / (t.truePositives + t.falsePositives)) * 100
              : 0),
          (m[e] =
            t.truePositives + t.falseNegatives > 0
              ? (t.truePositives / (t.truePositives + t.falseNegatives)) * 100
              : 0);
      }),
      {
        accuracy: o,
        classAccuracies: l,
        classPrecision: u,
        classRecall: m,
        confusionMatrix: i,
        medicalCorrelationScore: c,
      }
    );
  },
  calculateValidationError = (e, t) => {
    if (!t || 0 === t.length) return 0;
    let a = 0;
    return (
      t.forEach((t) => {
        const r = e.run(t.input),
          i = t.output;
        Object.keys(i).forEach((e) => {
          const t = i[e] - r[e];
          a += t * t;
        });
      }),
      a / (3 * t.length)
    );
  },
  calculateCurrentAccuracy = (e, t) => {
    if (!t || 0 === t.length) return 0;
    let a = 0;
    return (
      t.forEach((t) => {
        const r = e.run(t.input);
        Object.keys(t.output).reduce((e, a) =>
          t.output[e] > t.output[a] ? e : a
        ) === Object.keys(r).reduce((e, t) => (r[e] > r[t] ? e : t)) && a++;
      }),
      (a / t.length) * 100
    );
  },
  stratifiedSample = (e, t) => {
    const a = { normal: [], abnormal: [], critical: [] };
    e.forEach((e) => {
      const t =
          "critical" === e.bloodPressureStatus ||
          "critical" === e.heartRateStatus ||
          "critical" === e.oxygenLevelStatus ||
          "critical" === e.temperatureStatus,
        r =
          !t &&
          ("abnormal" === e.bloodPressureStatus ||
            "abnormal" === e.heartRateStatus ||
            "abnormal" === e.oxygenLevelStatus ||
            "abnormal" === e.temperatureStatus);
      t ? a.critical.push(e) : r ? a.abnormal.push(e) : a.normal.push(e);
    });
    const r = Math.floor(t / 3),
      i = t % 3,
      s = [];
    return (
      Object.keys(a).forEach((e, t) => {
        const n = a[e],
          o = r + (t < i ? 1 : 0);
        if (n.length <= o) s.push(...n);
        else {
          const e = [...n].sort(() => Math.random() - 0.5);
          s.push(...e.slice(0, o));
        }
      }),
      s.sort(() => Math.random() - 0.5)
    );
  };
app.get("/api/data-stats", (e, t) => {
  try {
    const e = getDataStats();
    t.json(e);
  } catch (e) {
    log(e.message, "error"),
      t
        .status(500)
        .json({
          success: !1,
          message: `Error getting data stats: ${e.message}`,
        });
  }
}),
  app.get("/api/health-data-sample", (e, t) => {
    try {
      if (!fs.existsSync(csvFilePath))
        return t.json({ records: [], totalRecords: 0 });
      const e = fs.readFileSync(csvFilePath, "utf8"),
        a = parseCSV(e),
        r = a.length,
        i = Math.min(1e4, r);
      let s;
      if (r <= i) s = a;
      else {
        const e = Math.floor(r / i);
        s = [];
        for (let t = 0; t < r && s.length < i; t += e) s.push(a[t]);
      }
      log(s.length, "info"), t.json({ records: s, totalRecords: r });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error reading health data sample: ${e.message}`,
          });
    }
  }),
  app.post("/api/predict", async (e, t) => {
    try {
      const { vitals: a } = e.body;
      if (!a || "object" != typeof a)
        return t
          .status(400)
          .json({ success: !1, message: "Invalid vital signs data provided" });
      const r = [
        "systolic",
        "diastolic",
        "heartRate",
        "oxygenLevel",
        "temperature",
      ];
      for (const e of r)
        if (void 0 === a[e] || null === a[e])
          return t
            .status(400)
            .json({
              success: !1,
              message: `Missing required vital sign: ${e}`,
            });
      if (!fs.existsSync(modelFilePath))
        return t
          .status(404)
          .json({
            success: !1,
            message: "No trained model found. Please train a model first.",
          });
      log(JSON.stringify(a), "info");
      const i = JSON.parse(fs.readFileSync(modelFilePath, "utf8")),
        s = {
          systolic: { min: 60, max: 250 },
          diastolic: { min: 40, max: 150 },
          heartRate: { min: 30, max: 200 },
          oxygenLevel: { min: 70, max: 100 },
          temperature: { min: 32, max: 45 },
        },
        n = {
          systolic: normalizeData(a.systolic, s.systolic.min, s.systolic.max),
          diastolic: normalizeData(
            a.diastolic,
            s.diastolic.min,
            s.diastolic.max
          ),
          heartRate: normalizeData(
            a.heartRate,
            s.heartRate.min,
            s.heartRate.max
          ),
          oxygenLevel: normalizeData(
            a.oxygenLevel,
            s.oxygenLevel.min,
            s.oxygenLevel.max
          ),
          temperature: normalizeData(
            a.temperature,
            s.temperature.min,
            s.temperature.max
          ),
        };
      let o;
      if ("neural-network" === i.method) {
        const e = new brain.NeuralNetwork();
        e.fromJSON(i.modelJson), (o = e.run(n));
      } else if ("knn" === i.method) {
        const e = new EnhancedKNNModel();
        e.fromJSON(i.modelJson), (o = e.run(n));
      } else {
        if ("ensemble" !== i.method)
          throw new Error(`Unsupported model type: ${i.method}`);
        {
          const e = new brain.NeuralNetwork();
          e.fromJSON(i.modelJson.neuralNetwork);
          const t = new EnhancedKNNModel();
          t.fromJSON(i.modelJson.knnModel);
          o = new EnsembleModel(e, t, i.modelJson.weights).run(n);
        }
      }
      const c = {
          normal: Math.max(0, Math.min(100, 100 * o.normal)),
          abnormal: Math.max(0, Math.min(100, 100 * o.abnormal)),
          critical: Math.max(0, Math.min(100, 100 * o.critical)),
        },
        l = c.normal + c.abnormal + c.critical;
      l > 0 &&
        ((c.normal = (c.normal / l) * 100),
        (c.abnormal = (c.abnormal / l) * 100),
        (c.critical = (c.critical / l) * 100));
      const u = Object.keys(c).reduce((e, t) => (c[e] > c[t] ? e : t)),
        m = Math.max(c.normal, c.abnormal, c.critical),
        g = generateEnhancedMedicalAnalysis(a, c, u),
        d = {
          success: !0,
          prediction: {
            probabilities: {
              normal: c.normal.toFixed(2),
              abnormal: c.abnormal.toFixed(2),
              critical: c.critical.toFixed(2),
            },
            status: u,
            confidence: m.toFixed(2),
            medicalAnalysis: g,
            modelInfo: {
              method: i.method,
              accuracy: i.accuracy?.toFixed(2),
              trainingRecords: i.recordCount,
              lastTrained: i.timestamp,
            },
          },
        };
      log(m.toFixed(2), "success"), t.json(d);
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error making prediction: ${e.message}`,
          });
    }
  }),
  app.post("/api/train-model", (e, t) => {
    try {
      const { method: a, config: r } = e.body;
      if (!a)
        return t
          .status(400)
          .json({ success: !1, message: "Training method not specified" });
      const i = Date.now().toString();
      (trainingJobs[i] = {
        method: a,
        config: r,
        progress: 0,
        completed: !1,
        success: !1,
        error: null,
        startTime: Date.now(),
        currentStep: "Initializing...",
        currentIteration: 0,
        currentError: 0,
      }),
        log(0, "info"),
        setTimeout(() => {
          trainModel(i, a, r);
        }, 100),
        t.json({ success: !0, message: "Training started", trainingId: i });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error starting training: ${e.message}`,
          });
    }
  }),
  app.get("/api/training-progress/:trainingId", (e, t) => {
    try {
      const { trainingId: a } = e.params;
      if (!trainingJobs[a])
        return t
          .status(404)
          .json({ success: !1, message: "Training job not found" });
      const r = trainingJobs[a],
        i = (Date.now() - r.startTime) / 1e3,
        s = r.progress > 0 ? (i / r.progress) * 100 : 0,
        n = Math.max(0, s - i),
        o = {
          ...r,
          elapsedTime: Math.floor(i),
          estimatedRemainingTime: Math.floor(n),
        };
      t.json(o);
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error checking training progress: ${e.message}`,
          });
    }
  });
const cleanupTrainingJobs = () => {
  const e = Date.now() - 36e5;
  Object.keys(trainingJobs).forEach((t) => {
    const a = trainingJobs[t];
    a.completed && a.startTime < e && (delete trainingJobs[t], log(0, "info"));
  });
};
setInterval(cleanupTrainingJobs, 18e5),
  app.get("/api/health-data", (e, t) => {
    try {
      if (!fs.existsSync(csvFilePath)) return t.json({ records: [] });
      const e = fs.readFileSync(csvFilePath, "utf8"),
        a = parseCSV(e);
      log(a.length, "info"), t.json({ records: a });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error reading health data: ${e.message}`,
          });
    }
  }),
  app.get("/api/model-info", (e, t) => {
    try {
      if (!fs.existsSync(modelFilePath)) return t.json({ exists: !1 });
      const e = JSON.parse(fs.readFileSync(modelFilePath, "utf8"));
      t.json({
        exists: !0,
        recordCount: e.recordCount,
        iterations: e.iterations,
        error: e.error,
        accuracy: e.accuracy,
        classAccuracies: e.classAccuracies,
        method: e.method,
        timestamp: e.timestamp,
        trainingDuration: e.trainingDuration,
        config: e.config,
      });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error getting model info: ${e.message}`,
          });
    }
  }),
  app.get("/api/model", (e, t) => {
    try {
      if (!fs.existsSync(modelFilePath))
        return (
          log(0, "warn"),
          t.status(404).json({ success: !1, message: "No saved model found" })
        );
      const e = fs.readFileSync(modelFilePath, "utf8");
      try {
        const a = JSON.parse(e);
        log(0, "info"), t.json(a);
      } catch (a) {
        log(a.message, "error"),
          log(e.substring(0, 200), "debug"),
          t
            .status(500)
            .json({
              success: !1,
              message: "Error parsing model data",
              error: a.message,
            });
      }
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({ success: !1, message: `Error loading model: ${e.message}` });
    }
  }),
  app.post("/api/save-data", (e, t) => {
    try {
      const { dataset: a } = e.body;
      if (!a || !Array.isArray(a) || 0 === a.length)
        return t
          .status(400)
          .json({ success: !1, message: "Invalid dataset provided" });
      ensureCSVExists();
      const r = a.map((e, t) => {
          const a = [
            "id",
            "timestamp",
            "systolic",
            "diastolic",
            "bloodPressureStatus",
            "heartRate",
            "heartRateStatus",
            "oxygenLevel",
            "oxygenLevelStatus",
            "temperature",
            "temperatureStatus",
          ];
          for (const r of a)
            if (void 0 === e[r] || null === e[r])
              throw new Error(
                `Missing required field '${r}' in record ${t + 1}`
              );
          return (
            (e.systolic < 60 || e.systolic > 250) &&
              log((e.systolic, e.id), "warn"),
            (e.diastolic < 40 || e.diastolic > 150) &&
              log((e.diastolic, e.id), "warn"),
            (e.heartRate < 30 || e.heartRate > 200) &&
              log((e.heartRate, e.id), "warn"),
            (e.oxygenLevel < 70 || e.oxygenLevel > 100) &&
              log((e.oxygenLevel, e.id), "warn"),
            (e.temperature < 32 || e.temperature > 45) &&
              log((e.temperature, e.id), "warn"),
            e
          );
        }),
        i = r
          .map((e) => [
            e.id,
            e.timestamp,
            e.systolic,
            e.diastolic,
            e.bloodPressureStatus,
            e.heartRate,
            e.heartRateStatus,
            e.oxygenLevel,
            e.oxygenLevelStatus,
            e.temperature,
            e.temperatureStatus,
          ])
          .map((e) => e.join(","))
          .join("\n");
      fs.appendFileSync(csvFilePath, i + "\n");
      const s = r.reduce((e, t) => {
          const a = [
            t.bloodPressureStatus,
            t.heartRateStatus,
            t.oxygenLevelStatus,
            t.temperatureStatus,
          ];
          let r = "normal";
          return (
            a.includes("critical")
              ? (r = "critical")
              : a.includes("abnormal") && (r = "abnormal"),
            (e[r] = (e[r] || 0) + 1),
            (e.bp = e.bp || {}),
            (e.hr = e.hr || {}),
            (e.o2 = e.o2 || {}),
            (e.temp = e.temp || {}),
            (e.bp[t.bloodPressureStatus] =
              (e.bp[t.bloodPressureStatus] || 0) + 1),
            (e.hr[t.heartRateStatus] = (e.hr[t.heartRateStatus] || 0) + 1),
            (e.o2[t.oxygenLevelStatus] = (e.o2[t.oxygenLevelStatus] || 0) + 1),
            (e.temp[t.temperatureStatus] =
              (e.temp[t.temperatureStatus] || 0) + 1),
            e
          );
        }, {}),
        n = calculateVitalSignCorrelations(r);
      log(r.length, "success"),
        log(
          JSON.stringify({
            normal: s.normal || 0,
            abnormal: s.abnormal || 0,
            critical: s.critical || 0,
          }),
          "info"
        ),
        log(n.qualityScore.toFixed(2), "info"),
        t.json({
          success: !0,
          message: `Successfully saved ${r.length} realistic health records to health_data.csv`,
          recordCount: r.length,
          statusDistribution: {
            overall: {
              normal: s.normal || 0,
              abnormal: s.abnormal || 0,
              critical: s.critical || 0,
            },
            individual: {
              bloodPressure: s.bp,
              heartRate: s.hr,
              oxygenLevel: s.o2,
              temperature: s.temp,
            },
          },
          dataQuality: n,
        });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({ success: !1, message: `Error saving data: ${e.message}` });
    }
  });
const calculateVitalSignCorrelations = (e) => {
  let t = 0,
    a = 0,
    r = 0,
    i = 0,
    s = 0;
  e.forEach((e) => {
    const n = e.systolic > 140 || e.diastolic > 90,
      o = e.heartRate > 100,
      c = e.oxygenLevel < 95,
      l = e.temperature > 38,
      u = e.systolic > 180 || e.diastolic > 110 || e.systolic < 90,
      m = e.heartRate > 120 || e.heartRate < 50,
      g = e.oxygenLevel < 90,
      d = e.temperature > 40 || e.temperature < 35;
    n && o && t++, c && o && a++, l && o && r++;
    [u, m, g, d].filter(Boolean).length >= 2 && i++;
    e.systolic >= 90 &&
      e.systolic <= 140 &&
      e.diastolic >= 60 &&
      e.diastolic <= 90 &&
      e.heartRate >= 60 &&
      e.heartRate <= 100 &&
      e.oxygenLevel >= 95 &&
      e.temperature >= 36 &&
      e.temperature <= 37.5 &&
      s++;
  });
  const n = e.length,
    o = {
      hypertensionWithTachycardia: (t / n) * 100,
      hypoxiaWithTachycardia: (a / n) * 100,
      feverWithTachycardia: (r / n) * 100,
      criticalMultiSystem: (i / n) * 100,
      normalCoherence: (s / n) * 100,
    },
    c = {
      hypertensionWithTachycardia: 60,
      hypoxiaWithTachycardia: 70,
      feverWithTachycardia: 65,
      criticalMultiSystem: 15,
      normalCoherence: 45,
    };
  let l = 0;
  return (
    Object.keys(c).forEach((e) => {
      const t = c[e],
        a = o[e],
        r = Math.abs(t - a) / t;
      l += Math.max(0, 100 - 100 * r);
    }),
    (l /= Object.keys(c).length),
    {
      correlations: o,
      qualityScore: l,
      percentages: {
        hypertensionWithTachycardia: o.hypertensionWithTachycardia.toFixed(1),
        hypoxiaWithTachycardia: o.hypoxiaWithTachycardia.toFixed(1),
        feverWithTachycardia: o.feverWithTachycardia.toFixed(1),
        criticalMultiSystem: o.criticalMultiSystem.toFixed(1),
        normalCoherence: o.normalCoherence.toFixed(1),
      },
    }
  );
};
app.get("/api/data-stats", (e, t) => {
  try {
    const e = getDataStats();
    if (e.totalRecords > 0 && fs.existsSync(csvFilePath)) {
      const t = fs.readFileSync(csvFilePath, "utf8"),
        a = parseCSV(t),
        r = Math.min(1e3, a.length),
        i = a.slice(0, r),
        s = calculateVitalSignCorrelations(i);
      (e.dataQuality = s),
        (e.analysisNote =
          r < a.length
            ? `Analysis based on sample of ${r} records`
            : `Analysis based on all ${a.length} records`);
    }
    t.json(e);
  } catch (e) {
    log(e.message, "error"),
      t
        .status(500)
        .json({
          success: !1,
          message: `Error getting data stats: ${e.message}`,
        });
  }
}),
  app.get("/api/data-quality", (e, t) => {
    try {
      if (!fs.existsSync(csvFilePath))
        return t.json({ exists: !1, message: "No health data file found" });
      const e = fs.readFileSync(csvFilePath, "utf8"),
        a = parseCSV(e);
      if (0 === a.length)
        return t.json({
          exists: !0,
          totalRecords: 0,
          message: "No records found in health data file",
        });
      const r = Math.min(5e3, a.length),
        i = a.slice(0, r),
        s = calculateVitalSignCorrelations(i),
        n = {
          vitalRangeDistribution: {
            systolic: {
              min: Math.min(...i.map((e) => e.systolic)),
              max: Math.max(...i.map((e) => e.systolic)),
            },
            diastolic: {
              min: Math.min(...i.map((e) => e.diastolic)),
              max: Math.max(...i.map((e) => e.diastolic)),
            },
            heartRate: {
              min: Math.min(...i.map((e) => e.heartRate)),
              max: Math.max(...i.map((e) => e.heartRate)),
            },
            oxygenLevel: {
              min: Math.min(...i.map((e) => e.oxygenLevel)),
              max: Math.max(...i.map((e) => e.oxygenLevel)),
            },
            temperature: {
              min: Math.min(...i.map((e) => e.temperature)),
              max: Math.max(...i.map((e) => e.temperature)),
            },
          },
          statusDistribution: i.reduce((e, t) => {
            const a = [
              t.bloodPressureStatus,
              t.heartRateStatus,
              t.oxygenLevelStatus,
              t.temperatureStatus,
            ];
            let r = "normal";
            return (
              a.includes("critical")
                ? (r = "critical")
                : a.includes("abnormal") && (r = "abnormal"),
              (e[r] = (e[r] || 0) + 1),
              e
            );
          }, {}),
          analysisSize: r,
          totalRecords: a.length,
        };
      log(s.qualityScore.toFixed(2), "info"),
        t.json({
          exists: !0,
          qualityScore: s.qualityScore,
          correlations: s.correlations,
          additionalMetrics: n,
          analysisNote:
            r < a.length
              ? `Analysis based on sample of ${r} records out of ${a.length} total`
              : `Analysis based on all ${a.length} records`,
        });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error analyzing data quality: ${e.message}`,
          });
    }
  }),
  app.get("/api/record-count", (e, t) => {
    try {
      if (!fs.existsSync(csvFilePath)) return t.json({ count: 0 });
      const e = fs
          .readFileSync(csvFilePath, "utf8")
          .split("\n")
          .filter((e) => e.trim()),
        a = Math.max(0, e.length - 1);
      t.json({ count: a });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error getting record count: ${e.message}`,
          });
    }
  }),
  app.get("/api/training-jobs", (e, t) => {
    try {
      const e = Object.keys(trainingJobs).map((e) => ({
        id: e,
        ...trainingJobs[e],
        elapsedTime: Math.floor((Date.now() - trainingJobs[e].startTime) / 1e3),
      }));
      t.json({ jobs: e });
    } catch (e) {
      log(e.message, "error"),
        t
          .status(500)
          .json({
            success: !1,
            message: `Error getting training jobs: ${e.message}`,
          });
    }
  }),
  fs.existsSync(path.join(__dirname, "dist", "index.html")) &&
    app.get("*", (e, t) => {
      t.sendFile(path.join(__dirname, "dist", "index.html"));
    }),
  app.listen(PORT, () => {
    log(0, "success"), log(0, "info"), log(0, "info"), log(0, "success");
  }),
  process.on("SIGINT", () => {
    log(0, "info"),
      Object.keys(trainingJobs).forEach((e) => {
        trainingJobs[e].completed ||
          ((trainingJobs[e].completed = !0),
          (trainingJobs[e].success = !1),
          (trainingJobs[e].error = "Server shutdown"),
          log(0, "warn"));
      }),
      process.exit(0);
  }),
  process.on("uncaughtException", (e) => {
    log(e.message, "error"), log(e.stack, "error");
  }),
  process.on("unhandledRejection", (e, t) => {
    log(0, "error");
  });
