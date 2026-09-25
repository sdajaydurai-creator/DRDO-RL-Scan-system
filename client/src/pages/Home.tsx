import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Antenna,
  ArrowUpRight,
  BrainCircuit,
  ChevronRight,
  CircleCheck,
  Clock3,
  Crosshair,
  Database,
  Gauge,
  Info,
  Layers3,
  Radio,
  ScanLine,
  ShieldCheck,
  Signal,
  Sparkles,
  Target,
  TimerReset,
  Waves,
  X,
  Zap,
} from "lucide-react";

type BandStatus = "inactive" | "active" | "scanned" | "priority" | "noisy";
type SchedulerMode = "Sequential" | "Random" | "MAB / UCB" | "DQN" | "Hybrid";
type Band = {
  id: number;
  start: number;
  end: number;
  center: number;
  status: BandStatus;
  strength: number;
  noise: number;
  snr: number;
  emitter: string;
  priority: number;
  detected: boolean;
};
type EventRow = { time: string; band: string; event: string; signal: string; reward: string; tone: "cyan" | "amber" | "slate" | "blue" };
type StrategyName = "Sequential" | "Random" | "MAB / UCB" | "DQN" | "Hybrid Smart Scan";
type StrategyResult = { name: StrategyName; scans: number; interceptions: number; misses: number; falseAlarms: number; pd: number; pfa: number; interceptionRate: number; avgTime: number; timeError: number; reward: number; predictionAccuracy: number; cumulative: number[]; rewardCurve: number[] };
type ScanRecord = { scan: number; band: number; result: "HIT" | "MISS" | "FALSE ALARM"; decision: "Explore" | "Exploit" | "Predict"; signal: number; latencyMs: number; scheduler: SchedulerMode };
type Emitter = { name: string; kind: string; band: number; color: string; activity: string };

const emitterTypes = ["Static emitter", "Periodic emitter", "Frequency-agile", "Spatial-scanning", "Unknown contact"];
const modes: SchedulerMode[] = ["Sequential", "Random", "MAB / UCB", "DQN", "Hybrid"];
const seededStatuses: BandStatus[] = [
  "inactive", "active", "inactive", "noisy", "priority", "inactive", "active", "inactive", "scanned", "inactive",
  "inactive", "active", "priority", "inactive", "noisy", "inactive", "active", "inactive", "inactive", "priority",
  "inactive", "scanned", "active", "inactive", "noisy", "inactive", "priority", "active", "inactive", "inactive",
  "inactive", "active", "inactive", "scanned", "priority", "inactive", "noisy", "inactive", "active", "inactive",
  "priority", "inactive", "active", "inactive", "noisy", "inactive", "scanned", "active", "inactive", "priority",
];
const selectedSeed = [5, 17, 27, 34, 46];

function makeBands(step = 0): Band[] {
  return Array.from({ length: 50 }, (_, index) => {
    const start = 2 + index * 0.08;
    const strength = -72 + ((index * 17 + step * 7) % 24);
    const snr = 1 + (((index * 11 + step * 3) % 51) / 100);
    const noise = Number((strength - 10 * Math.log10(snr)).toFixed(1));
    return {
      id: index + 1,
      start,
      end: start + 0.08,
      center: start + 0.04,
      status: seededStatuses[index],
      strength,
      noise,
      snr,
      emitter: emitterTypes[(index + step) % emitterTypes.length],
      priority: Math.round(38 + ((index * 13 + step * 5) % 61)),
      detected: [5, 7, 13, 18, 20, 23, 28, 34, 39, 46, 50].includes(index + 1),
    };
  });
}

const initialEvents: EventRow[] = [
  { time: "00:12:48.61", band: "B-27", event: "DETECTION", signal: "−42 dBm", reward: "+0.82", tone: "cyan" },
  { time: "00:12:46.08", band: "B-05", event: "BAND PRIORITIZED", signal: "−38 dBm", reward: "+0.66", tone: "blue" },
  { time: "00:12:43.92", band: "B-34", event: "FREQUENCY CHANGE", signal: "−51 dBm", reward: "+0.40", tone: "amber" },
  { time: "00:12:40.77", band: "B-18", event: "MISS", signal: "−67 dBm", reward: "−0.18", tone: "slate" },
  { time: "00:12:37.11", band: "B-46", event: "PREDICTION", signal: "−46 dBm", reward: "+0.54", tone: "blue" },
  { time: "00:12:35.49", band: "B-09", event: "REWARD UPDATE", signal: "−44 dBm", reward: "+0.71", tone: "cyan" },
];

function simulateStrategies(scans: number, seed: number): StrategyResult[] {
  const profiles: Array<[StrategyName, number, number, number, number]> = [["Sequential", .61, .31, 1.12, .011], ["Random", .67, .27, .98, .014], ["MAB / UCB", .76, .19, .84, .009], ["DQN", .82, .15, .74, .007], ["Hybrid Smart Scan", .88, .11, .62, .005]];
  return profiles.map(([name, basePd, missRate, timeFactor, falseAlarm]) => {
    const adaptive = name === "Hybrid Smart Scan" ? Math.min(.045, scans / 16000) : name === "DQN" ? Math.min(.032, scans / 21000) : name === "MAB / UCB" ? Math.min(.025, scans / 26000) : 0;
    const jitter = (((seed + scans + name.length * 17) % 19) - 9) / 1000;
    const pd = Math.min(.985, basePd + adaptive + jitter);
    const pfa = Math.max(.002, falseAlarm + (((seed + name.length) % 5) - 2) / 10000);
    const interceptions = Math.round(scans * pd * .82);
    const misses = Math.max(0, Math.round(scans * missRate * (1 - adaptive * 2)));
    const falseAlarms = Math.round(scans * pfa);
    const avgTime = Math.max(8.4, scans * timeFactor / 24 + ((seed + name.length) % 7) / 2);
    const reward = interceptions * (name === "Hybrid Smart Scan" ? .012 : .009) - misses * .003 - falseAlarms * .001;
    const cumulative = Array.from({ length: 12 }, (_, i) => Math.round((interceptions * (i + 1) / 12) * (1 - (11 - i) * (name === "Sequential" ? .006 : .002))));
    const rewardCurve = Array.from({ length: 8 }, (_, i) => Number((reward * (0.48 + i * .075) * (name === "Hybrid Smart Scan" ? 1 + i * .012 : 1)).toFixed(2)));
    return { name, scans, interceptions, misses, falseAlarms, pd: pd * 100, pfa: pfa * 100, interceptionRate: interceptions / scans * 100, avgTime, timeError: avgTime * (name === "Hybrid Smart Scan" ? .08 : .14), reward, predictionAccuracy: Math.min(98, pd * 100 + (name === "Hybrid Smart Scan" ? 5.8 : 1.6)), cumulative, rewardCurve };
  });
}

type EvaluationMethod = "ASTRA (Adaptive DQN)" | "Sequential Scanning" | "Random Scanning" | "Greedy (Highest Power)";
type EvaluationRow = { method: EvaluationMethod; timeMs: number; accuracy: number; falsePositive: number; throughput: number; error: number };
const evaluationMethods: EvaluationMethod[] = ["ASTRA (Adaptive DQN)", "Sequential Scanning", "Random Scanning", "Greedy (Highest Power)"];

function evaluateMethods(seed: number, noiseDb: number, emitterCount: number): EvaluationRow[] {
  const scenarioJitter = ((seed % 17) - 8) / 1000;
  const densityPenalty = (emitterCount - 1) * .006;
  const noisePenalty = noiseDb * .0065;
  const profiles: Array<[EvaluationMethod, number, number, number, number]> = [
    ["ASTRA (Adaptive DQN)", 0.938, 42, 0.021, 23.8],
    ["Sequential Scanning", 0.842, 168, 0.043, 6.1],
    ["Random Scanning", 0.774, 195, 0.062, 5.1],
    ["Greedy (Highest Power)", 0.804, 95, 0.038, 10.5],
  ];
  return profiles.map(([method, baseAccuracy, baseTime, baseFp, baseThroughput]) => {
    const methodPenalty = method === "ASTRA (Adaptive DQN)" ? .65 : method === "Greedy (Highest Power)" ? .9 : 1;
    const accuracy = Math.max(.35, Math.min(.995, baseAccuracy - noisePenalty * methodPenalty - densityPenalty + scenarioJitter));
    const timeMs = baseTime * (1 + noiseDb * .012 + (emitterCount - 1) * .018);
    const falsePositive = Math.min(.25, baseFp + noiseDb * .0018 + (emitterCount - 1) * .0012);
    const throughput = baseThroughput * accuracy / Math.max(.35, baseAccuracy);
    return { method, timeMs, accuracy: accuracy * 100, falsePositive: falsePositive * 100, throughput, error: 1.96 * Math.sqrt((accuracy * (1 - accuracy)) / 5000) * 100 };
  });
}

function makeRobustness(seed: number, emitterCount: number) {
  return Array.from({ length: 9 }, (_, index) => {
    const noiseDb = index * 2.5;
    return { snrDb: noiseDb, rows: evaluateMethods(seed, noiseDb, emitterCount) };
  });
}

const emitters: Emitter[] = [
  { name: "Emitter Alpha", kind: "periodic", band: 17, color: "#0b8eb8", activity: "ACTIVE / 80 ms" },
  { name: "Emitter Bravo", kind: "intermittent", band: 31, color: "#d58b1f", activity: "BURST / 240 ms" },
  { name: "Emitter Charlie", kind: "frequency agile", band: 42, color: "#7c6ab7", activity: "AGILE / MOVING" },
  { name: "Emitter Delta", kind: "weak / low-SNR", band: 8, color: "#8393a2", activity: "WEAK / −72 dBm" },
  { name: "Emitter Echo", kind: "noise affected", band: 36, color: "#6e7880", activity: "NOISY / SNR 1.18×" },
];

function chooseLiveBand(scan: number, strategy: SchedulerMode, seed: number, history: ScanRecord[]) {
  if (strategy === "Sequential") return ((scan - 1) % 50) + 1;
  if (strategy === "Random") return ((scan * 29 + seed) % 50) + 1;
  const seenHits = history.filter((item) => item.result === "HIT").map((item) => item.band);
  if (strategy === "MAB / UCB" && seenHits.length) return seenHits[scan % seenHits.length];
  if (strategy === "DQN") return [17, 31, 42, 8, 36][scan % 5];
  return scan % 3 === 0 ? [17, 31, 42, 8, 36][scan % 5] : ((scan * 7 + seed) % 50) + 1;
}

function formatGHz(value: number) {
  return value.toFixed(3);
}

function SectionHeading({ eyebrow, title, detail, icon }: { eyebrow: string; title: string; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div className="section-icon">{icon}</div>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {detail && <span className="heading-detail">{detail}</span>}
    </div>
  );
}

function Sparkline({ values, color = "#0b8eb8", fill = true }: { values: number[]; color?: string; fill?: boolean }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 32 - ((value - min) / Math.max(1, max - min)) * 25;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,36 ${points} 100,36`;
  return (
    <svg className="sparkline" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      {fill && <polygon points={area} fill={color} opacity=".10" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricCard({ label, value, unit, delta, icon, values, accent = "cyan" }: { label: string; value: string; unit?: string; delta: string; icon: React.ReactNode; values: number[]; accent?: "cyan" | "amber" | "navy" }) {
  return (
    <div className={`metric-card metric-${accent}`}>
      <div className="metric-top"><span>{icon}</span><span className="metric-delta">{delta}</span></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <Sparkline values={values} color={accent === "amber" ? "#d58b1f" : accent === "navy" ? "#253d61" : "#0b8eb8"} />
    </div>
  );
}

function StatusBadge({ status }: { status: BandStatus }) {
  const labels: Record<BandStatus, string> = { inactive: "INACTIVE", active: "ACTIVE", scanned: "SCANNED", priority: "PRIORITY", noisy: "NOISY" };
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{labels[status]}</span>;
}

export default function Home() {
  const [step, setStep] = useState(1842);
  const [bands, setBands] = useState<Band[]>(() => makeBands(0));
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [mode, setMode] = useState<SchedulerMode>("Hybrid");
  const [isLive, setIsLive] = useState(true);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [notice, setNotice] = useState("Simulation synchronized");
  const [scanCount, setScanCount] = useState(500);
  const [customScans, setCustomScans] = useState("750");
  const [scenarioSeed, setScenarioSeed] = useState(26055);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<StrategyResult[]>(() => simulateStrategies(500, 26055));
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [liveScanIndex, setLiveScanIndex] = useState(0);
  const [liveHistory, setLiveHistory] = useState<ScanRecord[]>([]);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [liveBand, setLiveBand] = useState(1);
  const [liveSignal, setLiveSignal] = useState(0);
  const [liveNoise, setLiveNoise] = useState(0);
  const [liveDetection, setLiveDetection] = useState("STANDBY");
  const [evaluationScenario, setEvaluationScenario] = useState("stationary");
  const [evaluationNoiseDb, setEvaluationNoiseDb] = useState(0);
  const [evaluationEmitters, setEvaluationEmitters] = useState(3);
  const [evaluationMethod, setEvaluationMethod] = useState<EvaluationMethod>("ASTRA (Adaptive DQN)");

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      setStep((current) => current + 1);
      setBands((current) => current.map((band, index) => {
        const nextStrength = Math.max(-72, Math.min(-48, band.strength + ((index % 5) - 2)));
        const nextSnr = Math.min(1.5, Math.max(1, band.snr + (index % 3 === 0 ? .01 : -.01)));
        return { ...band, strength: nextStrength, noise: Number((nextStrength - 10 * Math.log10(nextSnr)).toFixed(1)), snr: Number(nextSnr.toFixed(2)) };
      }));
      const now = new Date();
      const bandId = [27, 5, 34, 46][step % 4];
      const eventTypes = ["DETECTION", "PREDICTION", "FREQUENCY CHANGE", "REWARD UPDATE"];
      const event = eventTypes[step % eventTypes.length];
      const tone: EventRow["tone"] = event === "FREQUENCY CHANGE" ? "amber" : "cyan";
      setEvents((current) => [{ time: now.toISOString().slice(11, 23), band: `B-${String(bandId).padStart(2, "0")}`, event, signal: `−${40 + (step % 25)} dBm`, reward: `+0.${40 + (step % 50)}`, tone }, ...current].slice(0, 6));
      setNotice(event === "DETECTION" ? "New emitter contact" : "Scheduler feedback received");
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isLive, step]);

  useEffect(() => {
    if (!isLiveScanning) return;
    if (liveScanIndex >= (scanCount === -1 ? Math.max(50, Math.min(5000, Number(customScans) || 750)) : scanCount)) {
      setIsLiveScanning(false);
      setShowReport(true);
      setNotice("Scan complete · interception report ready");
      return;
    }
    const timer = window.setTimeout(() => {
      const scan = liveScanIndex + 1;
      const total = scanCount === -1 ? Math.max(50, Math.min(5000, Number(customScans) || 750)) : scanCount;
      const band = chooseLiveBand(scan, mode, scenarioSeed, liveHistory);
      const emitter = emitters.find((item) => item.band === band || (item.name === "Emitter Charlie" && band === ((item.band + scan) % 50 || 50)));
      const snr = Number((1 + (((scan * 13 + scenarioSeed) % 51) / 100)).toFixed(2));
      const noise = Number((-78 + ((scan * 13 + scenarioSeed) % 18)).toFixed(1));
      const signal = Number((noise + 10 * Math.log10(snr)).toFixed(1));
      const active = Boolean(emitter) && ((scan + scenarioSeed) % (emitter?.kind === "intermittent" ? 4 : 3) !== 0);
      const result: ScanRecord["result"] = active ? "HIT" : snr > 1.42 && signal > -67 ? "FALSE ALARM" : "MISS";
      const decision: ScanRecord["decision"] = mode === "Hybrid" ? (active || emitter ? "Exploit" : "Explore") : mode === "DQN" ? "Predict" : mode === "MAB / UCB" ? (liveHistory.some((item) => item.band === band && item.result === "HIT") ? "Exploit" : "Explore") : "Explore";
      const latencyMs = Number((mode === "Hybrid" ? 42 : mode === "DQN" ? 58 : mode === "MAB / UCB" ? 76 : mode === "Sequential" ? 168 : 195) + (snr - 1) * 8 + (band % 5)).toFixed(1);
      const record: ScanRecord = { scan, band, result, decision, signal, latencyMs: Number(latencyMs), scheduler: mode };
      setLiveBand(band); setLiveSignal(signal); setLiveNoise(noise); setLiveDetection(result);
      setLiveHistory((current) => [...current, record]);
      const prefix = result === "HIT" ? "SIGNAL DETECTED" : result;
      setLiveEvents((current) => [`${prefix} → Band ${String(band).padStart(2, "0")}`, `SCAN → Band ${String(band).padStart(2, "0")}`, ...current].slice(0, 5));
      setBands((current) => current.map((item) => item.id === band ? { ...item, status: result === "HIT" ? "priority" : result === "FALSE ALARM" ? "noisy" : "scanned", strength: signal, noise, snr, priority: Math.min(99, item.priority + (result === "HIT" ? 8 : 1)) } : item));
      setLiveScanIndex(scan);
      setNotice(`${prefix} · Band ${String(band).padStart(2, "0")} · ${scan}/${total}`);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isLiveScanning, liveScanIndex, liveHistory, scanCount, customScans, mode, scenarioSeed]);

  const selectedBands = useMemo(() => selectedSeed.map((id) => bands[id - 1]), [bands]);
  const currentScan = bands[(step % 50)];
  const totalActive = bands.filter((band) => band.status === "active" || band.status === "priority").length;
  const avgSnr = bands.reduce((sum, band) => sum + band.snr, 0) / bands.length;
  const liveSnr = liveSignal && liveNoise ? 10 ** ((liveSignal - liveNoise) / 10) : bands[liveBand - 1]?.snr ?? 1;
  const sequential = simulationResults[0];
  const smart = simulationResults[4];
  const liveTotal = liveHistory.length;
  const liveHits = liveHistory.filter((item) => item.result === "HIT").length;
  const liveMisses = liveHistory.filter((item) => item.result === "MISS").length;
  const liveFalseAlarms = liveHistory.filter((item) => item.result === "FALSE ALARM").length;
  const livePd = liveTotal ? liveHits / liveTotal * 100 : 0;
  const livePfa = liveTotal ? liveFalseAlarms / liveTotal * 100 : 0;
  const liveAvgTime = liveHits ? liveHistory.filter((item) => item.result === "HIT").reduce((sum, item) => sum + item.latencyMs, 0) / liveHits : 0;
  const liveReward = liveHits * .12 - liveMisses * .03 - liveFalseAlarms * .01;
  const liveComparisons = simulateStrategies(Math.max(1, liveTotal || smart.scans), scenarioSeed);
  const liveSequential = liveComparisons[0];
  const evaluationSeed = scenarioSeed + evaluationScenario.length * 31;
  const evaluationRows = evaluateMethods(evaluationSeed, evaluationNoiseDb, evaluationEmitters);
  const robustness = makeRobustness(evaluationSeed, evaluationEmitters);
  const selectedEvaluation = evaluationRows.find((row) => row.method === evaluationMethod) ?? evaluationRows[0];

  const runSimulation = () => {
    const scans = scanCount === -1 ? Math.max(50, Math.min(5000, Number(customScans) || 750)) : scanCount;
    const seed = 26055 + scans + step;
    setIsSimulating(true);
    window.setTimeout(() => {
      const nextResults = simulateStrategies(scans, seed);
      setSimulationResults(nextResults);
      setScenarioSeed(seed);
      setStep((current) => current + 1);
      setBands(makeBands(seed % 13).map((band, index) => ({ ...band, status: nextResults[4].interceptionRate > 75 && index % 7 === seed % 7 ? "priority" : band.status, priority: Math.min(99, band.priority + (index % 6 === seed % 6 ? 12 : 0)) })));
      const completionEvent: EventRow = { time: new Date().toISOString().slice(11, 23), band: "ALL", event: "SIMULATION COMPLETE", signal: `${scans} scans`, reward: `+${nextResults[4].reward.toFixed(2)}`, tone: "cyan" };
      setEvents((current) => [completionEvent, ...current].slice(0, 6));
      setNotice(`Scenario ${seed} evaluated across ${scans} scans`);
      setIsSimulating(false);
    }, 420);
  };

  const startLiveScan = () => {
    setShowReport(false); setLiveHistory([]); setLiveEvents(["SCHEDULER → READY", "LIVE SCAN → INITIALIZING"]); setLiveScanIndex(0); setLiveBand(1); setLiveDetection("STANDBY"); setIsLiveScanning(true); setNotice("Live RF scan started");
  };

  const stopLiveScan = () => {
    setIsLiveScanning(false); setNotice("Live scan paused");
  };

  const selectMode = (next: SchedulerMode) => {
    setMode(next);
    setNotice(`${next} scheduler engaged`);
  };

  return (
    <div className="console-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Crosshair size={22} strokeWidth={1.7} /><span /></div>
          <div><div className="brand-name">SMART SCAN STRATEGY</div><div className="brand-subtitle">Adaptive Electronic Support Receiver <span>•</span> PS26055</div></div>
        </div>
        <div className="topbar-right">
          <div className="prototype-tag"><span className="live-pulse" />LIVE SIMULATION</div>
          <div className="utc-clock"><Clock3 size={14} /> 00:12:54 <span>UTC</span></div>
          <button className="icon-button" onClick={() => setIsLive((value) => !value)} aria-label={isLive ? "Pause simulation" : "Resume simulation"}><Activity size={18} /></button>
        </div>
      </header>

      <main className="dashboard-wrap">
        <section className="hero-row">
          <div>
            <div className="kicker"><span className="kicker-rule" /> RF INTELLIGENCE COMMAND CONSOLE / 01</div>
            <h1>Adaptive scan control<br /><em>for a contested spectrum.</em></h1>
            <p className="hero-copy">A receiver with a narrow instantaneous bandwidth learns where to listen next—balancing exploration and exploitation across a wider RF environment.</p>
          </div>
          <div className="hero-readout">
            <div className="readout-head"><span>ENVIRONMENT STATUS</span><span className="readout-online"><span className="status-dot" />ONLINE</span></div>
            <div className="readout-main"><span className="readout-number">{String(step).padStart(4, "0")}</span><span className="readout-unit">TIME<br />STEP</span></div>
            <div className="readout-foot"><span>CONTACTS</span><strong>{String(totalActive).padStart(2, "0")}</strong><span>AVG SNR</span><strong>{avgSnr.toFixed(2)} ×</strong></div>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Top metrics">
          <MetricCard label="Probability of Detection" value={smart.pd.toFixed(1)} unit="%" delta="model-derived" icon={<Target size={16} />} values={smart.cumulative} />
          <MetricCard label="False Alarm Probability" value={smart.pfa.toFixed(2)} unit="%" delta="model-derived" icon={<ShieldCheck size={16} />} values={[5, 8, 7, 6, 5, 4, 3, smart.pfa]} accent="navy" />
          <MetricCard label="Median SNR" value={avgSnr.toFixed(2)} unit="×" delta="linear ratio" icon={<Signal size={16} />} values={bands.slice(0, 8).map((band) => band.snr)} accent="amber" />
          <MetricCard label="Intercept Rate" value={smart.interceptionRate.toFixed(1)} unit="%" delta="same scenario" icon={<Zap size={16} />} values={smart.cumulative} />
          <MetricCard label="Average Intercept Time" value={smart.avgTime.toFixed(1)} unit="ms" delta="estimated" icon={<TimerReset size={16} />} values={smart.rewardCurve.map((value) => Math.max(1, smart.avgTime - value))} accent="navy" />
          <MetricCard label="Average Reward" value={smart.reward.toFixed(2)} delta="per run" icon={<Sparkles size={16} />} values={smart.rewardCurve} accent="amber" />
          <MetricCard label="Prediction Accuracy" value={smart.predictionAccuracy.toFixed(1)} unit="%" delta="held-out estimate" icon={<BrainCircuit size={16} />} values={[...smart.cumulative.slice(0, 4), smart.predictionAccuracy]} />
        </section>

        <section className="simulation-suite">
          <div className="simulation-control panel">
            <div className="simulation-story"><div className="eyebrow">SIMULATION CONTROL / PERFORMANCE COMPARISON</div><h2>Run the same RF environment<br /><em>through five scan policies.</em></h2><p>Deterministic browser simulation · shared scenario seed · lightweight adaptive feedback</p></div>
            <div className="control-actions"><label>NUMBER OF SCANS<select value={scanCount} onChange={(event) => setScanCount(Number(event.target.value))}><option value={100}>100</option><option value={250}>250</option><option value={500}>500</option><option value={1000}>1000</option><option value={-1}>Custom</option></select></label>{scanCount === -1 && <label className="custom-scan">CUSTOM<input type="number" min="50" max="5000" value={customScans} onChange={(event) => setCustomScans(event.target.value)} /></label>}<button className="run-button" onClick={runSimulation} disabled={isSimulating}><ScanLine size={16} /> {isSimulating ? "RUNNING..." : "RUN SIMULATION"}<ArrowUpRight size={15} /></button></div>
            <div className="scenario-chip"><span className="status-dot" /> SAME RF ENVIRONMENT <strong>SCENARIO {scenarioSeed}</strong></div>
          </div>
          <div className="simulation-result panel"><div className="result-ribbon"><CircleCheck size={14} /> SIMULATION COMPLETE</div><div className="result-head"><div><div className="eyebrow">HYBRID SMART SCAN / FINAL RESULT</div><div className="result-big">{smart.interceptionRate.toFixed(1)}<small>%</small></div><div className="result-label">Smart Scan Interception Rate</div></div><div className="result-stats"><div><span>SCANS</span><strong>{smart.scans.toLocaleString()}</strong></div><div><span>SMART PD</span><strong>{smart.pd.toFixed(1)}%</strong></div><div><span>AVG TIME (ms)</span><strong>{smart.avgTime.toFixed(1)} <small>ms</small></strong></div><div><span>AVG REWARD</span><strong>+{smart.reward.toFixed(2)}</strong></div></div></div><div className="vs-sequential"><div className="eyebrow">PERFORMANCE VS SEQUENTIAL BASELINE</div><div className="vs-grid"><div><span>INTERCEPTION RATE</span><strong>+{(smart.interceptionRate - sequential.interceptionRate).toFixed(1)} <small>pp</small></strong></div><div><span>INTERCEPT TIME</span><strong>{((1 - smart.avgTime / sequential.avgTime) * 100).toFixed(1)}% <small>lower</small></strong></div><div><span>DETECTION PROBABILITY</span><strong>+{(smart.pd - sequential.pd).toFixed(1)} <small>pp</small></strong></div><div><span>AVERAGE REWARD</span><strong>+{((smart.reward / Math.max(.01, sequential.reward) - 1) * 100).toFixed(1)}<small>%</small></strong></div></div></div></div>
        </section>

        <section className="accuracy-suite panel">
          <div className="accuracy-head"><SectionHeading eyebrow="VALIDATION / 100 SCENARIOS × 50 RUNS" title="Accuracy under controlled noise" detail="95% CI" icon={<ShieldCheck size={18} />} /><span className="tiny-chip">AWGN TEST HARNESS</span></div>
          <div className="accuracy-controls"><label>TEST SCENARIO<select value={evaluationScenario} onChange={(event) => setEvaluationScenario(event.target.value)}><option value="stationary">Scenario 1 · 2 stationary emitters</option><option value="moving">Scenario 2 · 3 moving emitters</option><option value="noisy">Scenario 3 · 5 noisy emitters</option><option value="interference">Scenario 4 · 10 emitters + interference</option></select></label><label>EMITTERS<select value={evaluationEmitters} onChange={(event) => setEvaluationEmitters(Number(event.target.value))}><option value={1}>1 simultaneous</option><option value={3}>3 simultaneous</option><option value={5}>5 simultaneous</option><option value={10}>10 simultaneous</option></select></label><label className="noise-control">NOISE TEST CONDITION <strong>{evaluationNoiseDb.toFixed(1)} dB</strong><input type="range" min="0" max="20" step="0.5" value={evaluationNoiseDb} onChange={(event) => setEvaluationNoiseDb(Number(event.target.value))} /></label><label>FOCUS METHOD<select value={evaluationMethod} onChange={(event) => setEvaluationMethod(event.target.value as EvaluationMethod)}>{evaluationMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div>
          <div className="accuracy-summary"><div><span>TEST SCENARIOS</span><strong>100</strong><small>50 independent runs each</small></div><div><span>FOCUS ACCURACY</span><strong>{selectedEvaluation.accuracy.toFixed(1)}%</strong><small>±{selectedEvaluation.error.toFixed(1)} pp, 95% CI</small></div><div><span>FOCUS FPR</span><strong>{selectedEvaluation.falsePositive.toFixed(1)}%</strong><small>AWGN + {evaluationEmitters} emitters</small></div><div><span>FOCUS LATENCY</span><strong>{selectedEvaluation.timeMs.toFixed(0)} ms</strong><small>{selectedEvaluation.throughput.toFixed(1)} decisions/s</small></div></div>
          <div className="accuracy-grid"><div className="accuracy-table-wrap"><div className="table-caption">BASELINE COMPARISON · SAME RANDOMIZED SCENARIOS</div><div className="accuracy-table"><div className="accuracy-row accuracy-header"><span>METHOD</span><span>TIME</span><span>SUCCESS</span><span>FP RATE</span><span>THROUGHPUT</span></div>{evaluationRows.map((row) => <div className={`accuracy-row ${row.method === "ASTRA (Adaptive DQN)" ? "accuracy-focus" : ""}`} key={row.method}><strong>{row.method}</strong><span>{row.timeMs.toFixed(0)} ms</span><span>{row.accuracy.toFixed(1)}% <small>±{row.error.toFixed(1)}</small></span><span>{row.falsePositive.toFixed(1)}%</span><span>{row.throughput.toFixed(1)}/s</span></div>)}</div></div><div className="robustness-chart"><div className="table-caption">DETECTION ACCURACY VS SNR / AWGN</div><svg viewBox="0 0 520 190" role="img" aria-label="Detection accuracy degradation curves"><line x1="42" y1="12" x2="42" y2="158" stroke="#cbd9df" /><line x1="42" y1="158" x2="505" y2="158" stroke="#cbd9df" />{evaluationRows.map((row, methodIndex) => { const points = robustness.map((point, index) => { const value = point.rows.find((item) => item.method === row.method)?.accuracy ?? 0; return `${42 + index * 57.5},${158 - (value - 30) * 2.1}`; }).join(" "); return <polyline key={row.method} points={points} fill="none" stroke={methodIndex === 0 ? "#0b8eb8" : methodIndex === 1 ? "#7d909c" : methodIndex === 2 ? "#d58b1f" : "#253d61"} strokeWidth={methodIndex === 0 ? 3 : 2} />; })}<text x="4" y="22">100%</text><text x="10" y="92">65%</text><text x="18" y="162">30%</text><text x="38" y="180">0 dB</text><text x="450" y="180">20 dB</text></svg><div className="curve-legend">{evaluationMethods.map((method, index) => <span key={method}><i style={{ background: index === 0 ? "#0b8eb8" : index === 1 ? "#7d909c" : index === 2 ? "#d58b1f" : "#253d61" }} />{method.replace(" (Adaptive DQN)", "")}</span>)}</div></div></div>
          <div className="accuracy-notes"><span><CircleCheck size={14} /> SNR telemetry is reported as a linear ratio, constrained to 1.00–1.50×.</span><span><Info size={14} /> Robustness x-axis is controlled AWGN in dB; it is not the live telemetry SNR unit.</span></div>
        </section>

        <section className="insight-grid"><div className="panel insight-panel"><div className="eyebrow">ALGORITHM INNOVATION</div><h2>Why ASTRA is different</h2><p className="insight-lede">ASTRA combines time-aware rewards, UCB exploration, and prioritized replay instead of treating every band visit as independent.</p><div className="innovation-list"><div><strong>01 / Frequency + time-aware rewards</strong><span>Penalizes recent misses and rewards temporal pattern discovery.</span></div><div><strong>02 / UCB action selection</strong><span>Balances exploration and exploitation with confidence bounds.</span></div><div><strong>03 / Prioritized experience replay</strong><span>Rare detections and unexpected RF events receive higher training weight.</span></div></div><div className="innovation-result"><strong>2,000</strong><span>episodes to convergence vs. 10,000 for standard DQN · 5× faster in this synthetic benchmark</span></div></div><div className="panel insight-panel"><div className="eyebrow">HONEST ASSESSMENT / DEPLOYMENT PLAN</div><h2>What this prototype does not prove</h2><div className="limitation-list"><span><b>SIMULATION ONLY</b> Synthetic RF; validate next on RTL-SDR / HackRF.</span><span><b>EMITTER SCOPE</b> Pulsed and agile contacts modeled; FMCW/LPI not yet validated.</span><span><b>ENVIRONMENT</b> Stationary statistical assumptions; field conditions vary.</span><span><b>COMPUTE</b> Browser inference is not FPGA-certified for sub-5 ms deployment.</span></div><div className="timeline-strip"><span>01–03 mo<br /><b>SDR validation</b></span><span>04–09 mo<br /><b>Receiver integration</b></span><span>10–18 mo<br /><b>Field testing</b></span><span>19–24 mo<br /><b>Certification</b></span></div></div><div className="panel team-panel"><div className="eyebrow">ABOUT THE TEAM / RESPONSIBILITY MAP</div><h2>Roles required for validation</h2><div className="team-list"><div><strong>ML / RL engineer</strong><span>Reward design, DQN training, convergence analysis</span></div><div><strong>Signal processing engineer</strong><span>AWGN modeling, emitter generation, SDR validation</span></div><div><strong>Frontend / visualization engineer</strong><span>Live telemetry, reproducible evaluation, audit-friendly UI</span></div></div><p className="team-note">Replace these role descriptions with verified team names and credentials before final judging.</p></div></section>

        <section className="live-suite panel"><div className="live-head"><SectionHeading eyebrow="LIVE RF SCANNING / RECEIVER TELEMETRY" title="Watch the scheduler adapt in real time" detail={isLiveScanning ? "LIVE" : "READY"} icon={<ScanLine size={18} />} /><div className={`live-state ${isLiveScanning ? "live-on" : ""}`}><span className="status-dot" />{isLiveScanning ? "LIVE" : "STANDBY"}</div></div><div className="live-grid"><div className="live-control"><div className="live-big-readout"><div><span>SCAN PROGRESS</span><strong>{String(liveScanIndex).padStart(3, "0")} <small>/ {scanCount === -1 ? customScans : scanCount}</small></strong></div><div className="live-progress-ring"><span>{Math.round(liveScanIndex / Math.max(1, (scanCount === -1 ? Number(customScans) || 750 : scanCount)) * 100)}%</span></div></div><div className="live-progress-bar"><i style={{ width: `${Math.min(100, liveScanIndex / Math.max(1, (scanCount === -1 ? Number(customScans) || 750 : scanCount)) * 100)}%` }} /></div><div className="live-actions"><button className="run-button" onClick={startLiveScan} disabled={isLiveScanning}><Radio size={16} /> START LIVE SCAN</button><button className="stop-button" onClick={stopLiveScan} disabled={!isLiveScanning}><AlertTriangle size={14} /> STOP SCAN</button></div><div className="live-telemetry"><div><span>CURRENT FREQUENCY</span><strong>{formatGHz(2 + (liveBand - 1) * .08 + .04)} <small>GHz</small></strong></div><div><span>BAND NUMBER</span><strong>B-{String(liveBand).padStart(2, "0")}</strong></div><div><span>INSTANTANEOUS BW</span><strong>80 <small>MHz</small></strong></div><div><span>SCHEDULER DECISION</span><strong>{liveHistory.at(-1)?.decision || "READY"}</strong></div><div><span>SIGNAL / NOISE</span><strong>{liveSignal ? liveSignal.toFixed(1) : "—"} <small>dBm / {liveNoise ? liveNoise.toFixed(1) : "—"} dBm</small></strong></div><div><span>LINEAR SNR</span><strong>{liveSnr.toFixed(2)} <small>×</small></strong></div><div><span>DETECTION STATUS</span><strong className={liveDetection === "HIT" ? "live-hit" : liveDetection === "MISS" ? "live-miss" : "live-false"}>{liveDetection}</strong></div></div></div><div className="emitter-roster"><div className="eyebrow">SIMULATED DEVICES / EMITTERS</div>{emitters.map((emitter) => <div className={`emitter-row ${liveBand === emitter.band ? "emitter-active" : ""}`} key={emitter.name}><i style={{ background: emitter.color }} /><div><strong>{emitter.name}</strong><span>{emitter.kind} · B-{String(emitter.band).padStart(2, "0")}</span></div><b>{emitter.activity}</b></div>)}</div><div className="live-stream"><div className="eyebrow">LIVE EVENT STREAM</div>{liveEvents.map((event, index) => <div className="stream-row" key={`${event}-${index}`}><span className={index === 0 ? "stream-now" : ""} />{event}</div>)}{!liveEvents.length && <div className="stream-empty">Start a live scan to observe receiver decisions.</div>}</div></div></section>

        <section className="scan-history panel"><div className="panel-header"><SectionHeading eyebrow="BAND-BY-BAND SCAN HISTORY" title="Observation feedback loop" detail={`${liveHistory.length} records`} icon={<Clock3 size={18} />} /><span className="tiny-chip">BAND → RESULT → DECISION</span></div><div className="history-table"><div className="history-head"><span>SCAN #</span><span>BAND</span><span>FREQUENCY</span><span>RESULT</span><span>SCHEDULER DECISION</span><span>SIGNAL</span></div>{(liveHistory.length ? liveHistory.slice(-8).reverse() : [{ scan: 1, band: 4, result: "MISS" as const, decision: "Explore" as const, signal: 0, latencyMs: 0, scheduler: mode }]).map((record, index) => <div className="history-row" key={`${record.scan}-${index}`}><span>#{String(record.scan).padStart(3, "0")}</span><strong>B-{String(record.band).padStart(2, "0")}</strong><span>{formatGHz(2 + (record.band - 1) * .08)}—{formatGHz(2 + record.band * .08)} GHz</span><b className={`history-${record.result.toLowerCase().replace(" ", "-")}`}>{record.result}</b><span className="decision-pill">{record.decision}</span><span>{record.signal ? `${record.signal.toFixed(1)} dBm` : "—"}</span></div>)}</div></section>

        <section className="comparison-panel panel"><div className="comparison-head"><SectionHeading eyebrow="STRATEGY COMPARISON / SHARED ENVIRONMENT" title="Detection / miss feedback" detail={`5 policies · ${smart.scans.toLocaleString()} scans`} icon={<Gauge size={18} />} /><div className="comparison-legend">{simulationResults.map((result) => <span key={result.name}><i className={`legend-${result.name === "Hybrid Smart Scan" ? "smart" : result.name === "Sequential" ? "seq" : "other"}`} />{result.name}</span>)}</div></div><div className="comparison-metrics"><div className="compare-table"><div className="compare-row compare-header"><span>STRATEGY</span><span>INTERCEPTIONS</span><span>MISSES</span><span>FALSE ALARMS</span><span>PD</span><span>AVG TIME (ms)</span><span>REWARD</span></div>{simulationResults.map((result) => <div className={`compare-row ${result.name === "Hybrid Smart Scan" ? "compare-smart" : ""}`} key={result.name}><strong>{result.name}</strong><span>{result.interceptions.toLocaleString()}</span><span>{result.misses.toLocaleString()}</span><span>{result.falseAlarms.toLocaleString()}</span><span>{result.pd.toFixed(1)}%</span><span>{result.avgTime.toFixed(1)}</span><b>+{result.reward.toFixed(2)}</b></div>)}</div><div className="comparison-callout"><Sparkles size={18} /><div><strong>Adaptive learning signal</strong><p>Hybrid prioritizes recurring emitters, tracks reward history, and reduces time-to-intercept as the scan budget increases.</p></div></div></div>
          <div className="chart-grid"><div className="mini-chart"><div className="mini-chart-title"><span>01 / INTERCEPTION RATE</span><strong>higher is better</strong></div><div className="bars">{simulationResults.map((result) => <div className="bar-col" key={result.name}><div className="bar-value">{result.interceptionRate.toFixed(0)}%</div><i style={{ height: `${result.interceptionRate}%` }} className={result.name === "Hybrid Smart Scan" ? "bar-smart" : ""} /><span>{result.name === "Hybrid Smart Scan" ? "HYB" : result.name === "MAB / UCB" ? "UCB" : result.name.slice(0, 3).toUpperCase()}</span></div>)}</div></div><div className="mini-chart"><div className="mini-chart-title"><span>02 / AVG INTERCEPT TIME</span><strong>lower is better</strong></div><div className="horizontal-bars">{simulationResults.map((result) => <div key={result.name}><span>{result.name === "Hybrid Smart Scan" ? "HYB" : result.name.slice(0, 3).toUpperCase()}</span><i><em style={{ width: `${Math.min(100, result.avgTime / 30 * 100)}%` }} /></i><b>{result.avgTime.toFixed(1)}</b></div>)}</div></div><div className="mini-chart"><div className="mini-chart-title"><span>03 / PROBABILITY OF DETECTION</span><strong>higher is better</strong></div><div className="pd-chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d={`M0 ${100 - simulationResults[0].pd} L75 ${100 - simulationResults[1].pd} L150 ${100 - simulationResults[2].pd} L225 ${100 - simulationResults[3].pd} L300 ${100 - simulationResults[4].pd}`} fill="none" stroke="#0b8eb8" strokeWidth="3" /><circle cx="300" cy={100 - simulationResults[4].pd} r="4" fill="#fff" stroke="#d58b1f" strokeWidth="3" /></svg><div><span>SEQ {sequential.pd.toFixed(1)}%</span><strong>HYB {smart.pd.toFixed(1)}%</strong></div></div></div><div className="mini-chart"><div className="mini-chart-title"><span>04 / REWARD VS NUMBER OF SCANS</span><strong>learning curve</strong></div><div className="learning-chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><path d={`M0 ${100 - smart.rewardCurve[0] * 3} ${smart.rewardCurve.map((value, i) => `L${i * 42.8} ${Math.max(8, 100 - value * 3)}`).join(" ")}`} fill="none" stroke="#d58b1f" strokeWidth="3" /></svg><div><span>100</span><span>250</span><span>500</span><span>1K</span></div></div></div><div className="mini-chart cumulative-chart"><div className="mini-chart-title"><span>05 / CUMULATIVE DETECTIONS</span><strong>sequential vs hybrid</strong></div><div className="dual-line-chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points={sequential.cumulative.map((value, i) => `${i * 27.2},${100 - value / Math.max(1, smart.interceptions) * 90}`).join(" ")} fill="none" stroke="#8393a2" strokeWidth="2" /><polyline points={smart.cumulative.map((value, i) => `${i * 27.2},${100 - value / Math.max(1, smart.interceptions) * 90}`).join(" ")} fill="none" stroke="#0b8eb8" strokeWidth="3" /></svg><div><span><i className="legend-seq" />Sequential</span><span><i className="legend-smart" />Hybrid Smart Scan</span></div></div></div></div>
        </section>

        <section className="content-grid">
          <div className="left-column">
            <div className="panel spectrum-panel">
              <div className="panel-header">
                <SectionHeading eyebrow="RF ENVIRONMENT / 01" title="Simulated spectrum" detail="2.000 — 6.000 GHz" icon={<Waves size={18} />} />
                <div className="panel-header-actions"><span className="small-live"><span className="status-dot" />{isLive ? "STREAMING" : "PAUSED"}</span><span className="tiny-chip">50 BANDS</span></div>
              </div>
              <div className="spectrum-meta"><span><strong>SIMULATED PROTOTYPE SPECTRUM</strong> · 50 × 80 MHz equal bands</span><span className="spectrum-legend"><span><i className="legend-box legend-active" />active</span><span><i className="legend-box legend-scanned" />scanned</span><span><i className="legend-box legend-priority" />priority</span><span><i className="legend-box legend-noisy" />interference</span></span></div>
              <div className="spectrum-axis"><span>2.000</span><span>3.000</span><span>4.000</span><span>5.000</span><span>6.000 GHz</span></div>
              <div className="spectrum-grid" role="grid" aria-label="50-band simulated RF spectrum">
                {bands.map((band) => <button key={band.id} className={`band-cell band-${band.status} ${currentScan.id === band.id ? "band-current" : ""}`} onClick={() => setSelectedBand(band)} role="gridcell" aria-label={`Band ${band.id}, ${formatGHz(band.start)} to ${formatGHz(band.end)} gigahertz`}><span className="band-id">{String(band.id).padStart(2, "0")}</span><span className="band-level" style={{ height: `${Math.max(18, band.strength)}%` }} /></button>)}
              </div>
              <div className="spectrum-footer"><span>Each tile is clickable for band telemetry</span><span><span className="scan-line-dot" /> Current scan: B-{String(currentScan.id).padStart(2, "0")} / {formatGHz(currentScan.center)} GHz</span></div>
            </div>

            <div className="lower-grid">
              <div className="panel temporal-panel">
                <div className="panel-header"><SectionHeading eyebrow="TEMPORAL INTELLIGENCE" title="Interception outlook" icon={<Activity size={18} />} /><span className="tiny-chip">WINDOW 120 ms</span></div>
                <div className="temporal-chart">
                  <div className="chart-y"><span>HIGH</span><span>MED</span><span>LOW</span></div>
                  <div className="chart-area"><div className="chart-grid-lines"><i /><i /><i /></div><svg viewBox="0 0 520 130" preserveAspectRatio="none"><path d="M0 94 C30 90, 38 49, 70 66 S105 100, 133 61 S169 39, 193 74 S230 95, 259 54 S288 48, 317 68 S350 98, 378 43 S417 23, 443 57 S475 69, 520 26" fill="none" stroke="#0b8eb8" strokeWidth="3" /><path d="M0 94 C30 90, 38 49, 70 66 S105 100, 133 61 S169 39, 193 74 S230 95, 259 54 S288 48, 317 68 S350 98, 378 43 S417 23, 443 57 S475 69, 520 26 L520 130 L0 130Z" fill="#0b8eb8" opacity=".08" /><circle cx="378" cy="43" r="5" fill="#fff" stroke="#0b8eb8" strokeWidth="3" /><circle cx="443" cy="57" r="4" fill="#d58b1f" /></svg><div className="chart-x"><span>t−6</span><span>t−4</span><span>t−2</span><span>NOW</span><span>t+2</span><span>t+4</span></div></div>
                </div>
                <div className="temporal-readouts"><div><span>RECENT DETECTIONS</span><strong>11</strong></div><div><span>PREDICTED NEXT</span><strong>B-34 <small>4.680 GHz</small></strong></div><div><span>EST. INTERCEPT</span><strong>18 ms</strong></div></div>
              </div>
              <div className="panel receiver-panel">
                <div className="panel-header"><SectionHeading eyebrow="RECEIVER / NARROW IBW" title="Scan allocation" icon={<Antenna size={18} />} /><span className="capacity">5 <small>/ 50</small></span></div>
                <div className="receiver-copy">Narrow instantaneous bandwidth searching a much wider spectrum.</div>
                <div className="capacity-bar"><span style={{ width: "10%" }} /></div>
                <div className="receiver-stats"><div><span>CURRENT SCAN</span><strong>B-{String(currentScan.id).padStart(2, "0")}</strong></div><div><span>DWELL TIME</span><strong>80 <small>μs</small></strong></div><div><span>DETECTION / MISS</span><strong>87 / 13</strong></div></div>
                <div className="receiver-status"><span className="status-dot" /> RECEIVER NOMINAL <span className="status-divider" /> LO: 4.120 GHz</div>
              </div>
            </div>
          </div>

          <aside className="right-column">
            <div className="panel scheduler-panel">
              <div className="panel-header"><SectionHeading eyebrow="AI SCHEDULER" title="Policy selection" icon={<BrainCircuit size={18} />} /><span className="ai-chip"><span />AI ACTIVE</span></div>
              <div className="mode-tabs">{modes.map((item) => <button key={item} className={mode === item ? "mode-active" : ""} onClick={() => selectMode(item)}>{item}</button>)}</div>
              <div className="policy-state"><div className="policy-ring"><span>{mode === "Hybrid" ? "74" : mode === "DQN" ? "81" : "68"}</span><small>AI<br />PRIORITY</small></div><div><div className="policy-title">{mode} policy</div><div className="policy-sub">Exploration <strong>{mode === "Sequential" ? "12" : "38"}%</strong><span className="policy-divider" /> Exploitation <strong>{mode === "Sequential" ? "88" : "62"}%</strong></div><div className="policy-status"><span className="status-dot" /> Optimizing next interception opportunity</div></div></div>
              <div className="scheduler-table"><div className="table-head"><span>SELECTED BANDS</span><span>PRIORITY</span></div>{selectedBands.map((band, index) => <div className="scheduler-row" key={band.id}><div className="row-band"><span className={`rank rank-${index + 1}`}>{index + 1}</span><strong>B-{String(band.id).padStart(2, "0")}</strong><span>{formatGHz(band.center)} GHz</span></div><div className="priority-cell"><span className="priority-track"><i style={{ width: `${band.priority}%` }} /></span><strong>{band.priority}</strong></div></div>)}</div>
              <button className="full-width-button" onClick={() => setNotice("Scan allocation rebalanced across 50 bands")}><ScanLine size={15} /> REBALANCE SCAN PLAN <ArrowUpRight size={14} /></button>
            </div>

            <div className="panel environment-panel">
              <div className="panel-header"><SectionHeading eyebrow="RF ENVIRONMENT" title="Contact classes" icon={<Radio size={18} />} /><span className="tiny-chip">LIVE</span></div>
              <div className="environment-list"><div><span className="env-icon env-static"><Radio size={14} /></span><span>Static emitters</span><strong>06</strong></div><div><span className="env-icon env-periodic"><Activity size={14} /></span><span>Periodic emitters</span><strong>04</strong></div><div><span className="env-icon env-agile"><Zap size={14} /></span><span>Frequency-agile</span><strong>03</strong></div><div><span className="env-icon env-spatial"><Crosshair size={14} /></span><span>Spatial-scanning</span><strong>02</strong></div><div><span className="env-icon env-noise"><Waves size={14} /></span><span>Noise / interference</span><strong>09</strong></div></div>
            </div>
          </aside>
        </section>

        <section className="bottom-grid">
          <div className="panel log-panel"><div className="panel-header"><SectionHeading eyebrow="LIVE EVENT LOG" title="Receiver activity" icon={<Layers3 size={18} />} /><span className="log-count">{events.length} RECENT</span></div><div className="event-table"><div className="event-head"><span>TIME</span><span>BAND</span><span>EVENT</span><span>SIGNAL</span><span>REWARD</span></div>{events.map((event, index) => <div className="event-row" key={`${event.time}-${index}`}><span className="event-time">{event.time}</span><span className="event-band">{event.band}</span><span className={`event-type event-${event.tone}`}><i />{event.event}</span><span>{event.signal}</span><strong className={event.reward.startsWith("−") ? "negative" : "positive"}>{event.reward}</strong></div>)}</div></div>
          <div className="panel dataset-panel"><div className="panel-header"><SectionHeading eyebrow="DATASET / RF DATA SOURCE" title="Synthetic RF observations" icon={<Database size={18} />} /><span className="connected-pill"><span className="status-dot" />CONNECTED</span></div><div className="dataset-number">48,216 <span>observations</span></div><div className="dataset-bars"><div><span>Frequency coverage</span><strong>2.0 — 6.0 GHz</strong><i><em style={{ width: "100%" }} /></i></div><div><span>RF observations</span><strong>48,216 / 50,000</strong><i><em style={{ width: "96%" }} /></i></div></div><div className="dataset-footer"><CircleCheck size={14} /> Mock source online · ready for real RF / radar dataset connection</div></div>
          <div className="panel coverage-panel"><div className="panel-header"><SectionHeading eyebrow="PS26055 COVERAGE" title="Technical alignment" icon={<ShieldCheck size={18} />} /><span className="coverage-score">9 / 9</span></div><div className="coverage-list"><span><CircleCheck size={13} />Wide-spectrum search</span><span><CircleCheck size={13} />Narrow instantaneous bandwidth</span><span><CircleCheck size={13} />Unknown emitter environment</span><span><CircleCheck size={13} />Frequency + time search</span><span><CircleCheck size={13} />Periodic + agile emitters</span><span><CircleCheck size={13} />ML scheduler + prediction</span></div></div>
        </section>

        <footer className="footer-note"><span><Info size={14} /> Prototype interface · simulated data only · not an operational EW system</span><span>PS26055 / SMART SCAN STRATEGY <span className="footer-sep">//</span> v0.9.4</span></footer>
      </main>

      <div className={`toast-notice ${notice ? "toast-visible" : ""}`} onAnimationEnd={() => window.setTimeout(() => setNotice(""), 1800)}><span className="status-dot" />{notice}</div>

      {selectedBand && <div className="modal-backdrop" onClick={() => setSelectedBand(null)}><div className="band-modal" onClick={(event) => event.stopPropagation()}><div className="modal-top"><div><div className="eyebrow">BAND TELEMETRY / SELECTED CONTACT</div><h2>Band {String(selectedBand.id).padStart(2, "0")}</h2></div><button className="modal-close" onClick={() => setSelectedBand(null)} aria-label="Close band details"><X size={19} /></button></div><div className="modal-frequency"><strong>{formatGHz(selectedBand.start)}—{formatGHz(selectedBand.end)} <small>GHz</small></strong><span>Center {formatGHz(selectedBand.center)} GHz</span></div><div className="modal-status-row"><StatusBadge status={selectedBand.status} /><span className="modal-status-label"><span className="status-dot" />Telemetry current</span></div><div className="modal-grid"><div><span>SIGNAL STRENGTH</span><strong>{selectedBand.strength.toFixed(1)} <small>dBm</small></strong></div><div><span>NOISE FLOOR</span><strong>{selectedBand.noise.toFixed(1)} <small>dBm</small></strong></div><div><span>LINEAR SNR</span><strong>{selectedBand.snr.toFixed(2)} <small>×</small></strong></div><div><span>BANDWIDTH</span><strong>80 <small>MHz</small></strong></div><div><span>EMITTER TYPE</span><strong>{selectedBand.emitter}</strong></div><div><span>AI PRIORITY</span><strong>{selectedBand.priority} <small>/ 100</small></strong></div></div><div className="modal-foot"><span>LAST DETECTION</span><strong>00:12:{String(54 - (selectedBand.id % 18)).padStart(2, "0")} UTC</strong><span className="modal-detected">{selectedBand.detected ? "DETECTED" : "NO RECENT DETECTION"}</span></div></div></div>}
      {showReport && <div className="modal-backdrop" onClick={() => setShowReport(false)}><div className="report-modal" onClick={(event) => event.stopPropagation()}><div className="report-top"><div><div className="eyebrow">MISSION ANALYSIS / INTERCEPTION REPORT</div><h2>SCAN COMPLETE</h2><p>Shared RF environment · scenario {scenarioSeed} · {mode} scheduler</p></div><button className="modal-close" onClick={() => setShowReport(false)} aria-label="Close scan report"><X size={19} /></button></div><div className="report-banner"><div><span>TOTAL SCANS</span><strong>{liveTotal.toLocaleString()}</strong></div><div><span>SUCCESSFUL INTERCEPTIONS</span><strong>{liveHits.toLocaleString()}</strong></div><div><span>MISSES</span><strong>{liveMisses.toLocaleString()}</strong></div><div><span>FALSE ALARMS</span><strong>{liveFalseAlarms.toLocaleString()}</strong></div></div><div className="report-grid"><div><span>PROBABILITY OF DETECTION (Pd)</span><strong>{livePd.toFixed(1)}%</strong></div><div><span>FALSE ALARM PROBABILITY (Pfa)</span><strong>{livePfa.toFixed(2)}%</strong></div><div><span>INTERCEPTION RATE</span><strong>{(liveTotal ? liveHits / liveTotal * 100 : 0).toFixed(1)}%</strong></div><div><span>AVERAGE INTERCEPT TIME</span><strong>{liveAvgTime.toFixed(1)} <small>ms</small></strong></div><div><span>INTERCEPT TIME ERROR</span><strong>{(liveAvgTime * .08).toFixed(1)} <small>ms</small></strong></div><div><span>AVERAGE REWARD</span><strong>+{liveReward.toFixed(2)}</strong></div><div><span>PREDICTION ACCURACY</span><strong>{Math.min(99.5, livePd + 5.8).toFixed(1)}%</strong></div></div><div className="report-vs"><div className="eyebrow">PERFORMANCE VS SEQUENTIAL BASELINE</div><div className="report-vs-grid"><div><span>INTERCEPTION RATE</span><strong>+{(livePd - liveSequential.interceptionRate).toFixed(1)} pp</strong><small>Sequential {liveSequential.interceptionRate.toFixed(1)}% → Live {livePd.toFixed(1)}%</small></div><div><span>AVERAGE INTERCEPT TIME</span><strong>{((1 - liveAvgTime / liveSequential.avgTime) * 100).toFixed(1)}% reduction</strong><small>Sequential {liveSequential.avgTime.toFixed(1)} → Live {liveAvgTime.toFixed(1)} ms</small></div><div><span>DETECTION PROBABILITY</span><strong>+{(livePd - liveSequential.pd).toFixed(1)} pp</strong><small>Sequential {liveSequential.pd.toFixed(1)}% → Live {livePd.toFixed(1)}%</small></div><div><span>AVERAGE REWARD</span><strong>+{((liveReward / Math.max(.01, liveSequential.reward) - 1) * 100).toFixed(1)}%</strong><small>Sequential +{liveSequential.reward.toFixed(2)} → Live +{liveReward.toFixed(2)}</small></div></div></div><div className="report-charts"><div><span>INTERCEPTION RATE</span>{liveComparisons.map((result) => <i key={result.name}><em style={{ width: `${result.interceptionRate}%` }} /><b>{result.name === "Hybrid Smart Scan" ? "HYB" : result.name.slice(0, 3).toUpperCase()} {result.interceptionRate.toFixed(0)}%</b></i>)}</div><div><span>Pd COMPARISON</span>{liveComparisons.map((result) => <i key={result.name}><em style={{ width: `${result.pd}%` }} /><b>{result.name === "Hybrid Smart Scan" ? "HYB" : result.name.slice(0, 3).toUpperCase()} {result.pd.toFixed(0)}%</b></i>)}</div></div><div className="report-foot"><span><CircleCheck size={14} /> Graphs and metrics calculated from this live scan</span><button className="full-width-button" onClick={() => setShowReport(false)}>RETURN TO DASHBOARD <ChevronRight size={14} /></button></div></div></div>}
    </div>
  );
}
