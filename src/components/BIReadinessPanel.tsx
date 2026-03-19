import { useState } from 'react';
import {
  BIReadinessReport,
  PillarResult,
  PillarCheck,
  DomainViolation,
  DistributionShift,
  GhostDataResult,
  SchemaChange,
} from '@/lib/biReadiness';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Database,
  BarChart3,
  Eye,
  Fingerprint,
  Clock,
  FileCheck,
  Ghost,
  ArrowRightLeft,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  report: BIReadinessReport;
}

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  Accuracy: <Fingerprint className="w-4 h-4" />,
  Completeness: <Database className="w-4 h-4" />,
  Consistency: <ArrowRightLeft className="w-4 h-4" />,
  Timeliness: <Clock className="w-4 h-4" />,
  Validity: <FileCheck className="w-4 h-4" />,
};

function StatusIcon({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-success" />;
  if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-warning" />;
  return <XCircle className="w-5 h-5 text-destructive" />;
}

function ScoreBadge({ score, large }: { score: number; large?: boolean }) {
  const color = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bg = score >= 80 ? 'bg-success/10' : score >= 50 ? 'bg-warning/10' : 'bg-destructive/10';
  return (
    <div className={cn('rounded-lg flex items-center justify-center font-bold', bg, color, large ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-sm')}>
      {score}
    </div>
  );
}

function PillarCard({ pillar }: { pillar: PillarResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left">
        {PILLAR_ICONS[pillar.name] || <ShieldCheck className="w-4 h-4" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{pillar.name}</span>
            <StatusIcon status={pillar.status} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{pillar.summary}</p>
        </div>
        <ScoreBadge score={pillar.score} />
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-2 bg-muted/20">
          {pillar.checks.map((check, i) => (
            <CheckRow key={i} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: PillarCheck }) {
  const icon = check.passed
    ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
    : check.severity === 'critical'
    ? <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
    : <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />;

  return (
    <div className="flex items-start gap-2 text-xs">
      {icon}
      <div>
        <span className="font-medium text-foreground">{check.name}</span>
        <span className="text-muted-foreground"> — {check.message}</span>
        {check.affectedCount !== undefined && check.affectedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">{check.affectedCount} affected</span>
        )}
      </div>
    </div>
  );
}

function DomainViolationsSection({ violations }: { violations: DomainViolation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (violations.length === 0) return null;

  const grouped = violations.reduce<Record<string, DomainViolation[]>>((acc, v) => {
    acc[v.rule] = acc[v.rule] || [];
    acc[v.rule].push(v);
    return acc;
  }, {});

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <div className="flex-1">
          <span className="font-semibold text-foreground text-sm">Domain Constraint Violations</span>
          <p className="text-xs text-muted-foreground">{violations.length} violation(s) across {Object.keys(grouped).length} rule(s)</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/20 max-h-60 overflow-y-auto">
          {Object.entries(grouped).map(([rule, items]) => (
            <div key={rule}>
              <div className="text-xs font-semibold text-foreground mb-1 capitalize">{rule.replace(/_/g, ' ')} ({items.length})</div>
              {items.slice(0, 10).map((v, i) => (
                <div key={i} className="text-xs text-muted-foreground ml-4">Row {v.rowIndex + 1}: {v.description}</div>
              ))}
              {items.length > 10 && <div className="text-xs text-muted-foreground ml-4 italic">...and {items.length - 10} more</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GhostDataSection({ ghost }: { ghost: GhostDataResult[] }) {
  if (ghost.length === 0) return null;
  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Ghost className="w-4 h-4 text-warning" />
        <span className="font-semibold text-foreground text-sm">Ghost Data Detected</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Hidden characters, trailing spaces, and tabs cause BI join failures
      </p>
      <div className="space-y-1">
        {ghost.map((g, i) => (
          <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">{g.column}:</span>
            {g.leadingSpaces > 0 && <span>{g.leadingSpaces} leading</span>}
            {g.trailingSpaces > 0 && <span>{g.trailingSpaces} trailing</span>}
            {g.tabChars > 0 && <span>{g.tabChars} tabs</span>}
            {g.hiddenChars > 0 && <span>{g.hiddenChars} hidden</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReconciliationSection({ report }: { report: BIReadinessReport }) {
  const recon = report.reconciliation;
  if (!recon) return null;

  const [expanded, setExpanded] = useState(false);
  const significantShifts = recon.distributionShifts.filter(d => d.isSignificant);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left">
        <Activity className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <span className="font-semibold text-foreground text-sm">Reconciliation Audit</span>
          <p className="text-xs text-muted-foreground">
            {recon.rowCountBefore} → {recon.rowCountAfter} rows 
            {recon.rowsDropped > 0 ? ` (${recon.rowsDropped} dropped)` : ''} 
            {significantShifts.length > 0 ? ` • ${significantShifts.length} distribution shift(s)` : ''} 
            {recon.schemaChanges.length > 0 ? ` • ${recon.schemaChanges.length} schema change(s)` : ''}
          </p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          {/* Row Count */}
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-1">Row Count Reconciliation</h5>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-muted text-center"><div className="font-bold text-foreground">{recon.rowCountBefore}</div><div className="text-muted-foreground">Before</div></div>
              <div className="p-2 rounded bg-muted text-center"><div className="font-bold text-foreground">{recon.rowCountAfter}</div><div className="text-muted-foreground">After</div></div>
              <div className={cn('p-2 rounded text-center', recon.rowsDropped > 0 ? 'bg-warning/10' : 'bg-success/10')}>
                <div className={cn('font-bold', recon.rowsDropped > 0 ? 'text-warning' : 'text-success')}>{recon.rowsDropped}</div>
                <div className="text-muted-foreground">Dropped</div>
              </div>
            </div>
          </div>

          {/* Distribution Shifts */}
          {recon.distributionShifts.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-1">Distribution Shift Analysis</h5>
              <div className="space-y-1">
                {recon.distributionShifts.slice(0, 10).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {d.isSignificant ? <AlertTriangle className="w-3 h-3 text-warning" /> : <CheckCircle2 className="w-3 h-3 text-success" />}
                    <span className="font-medium text-foreground">{d.column}:</span>
                    <span className="text-muted-foreground">μ {d.meanBefore} → {d.meanAfter} ({d.shiftPercent}% shift), σ {d.stdDevBefore} → {d.stdDevAfter}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schema Changes */}
          {recon.schemaChanges.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-1">Schema Changes</h5>
              {recon.schemaChanges.map((s, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className={cn('px-1 rounded text-[10px] font-medium', s.type === 'added' ? 'bg-success/10 text-success' : s.type === 'removed' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                    {s.type}
                  </span>
                  {s.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BIReadinessPanel({ report }: Props) {
  const overallIcon = report.overallStatus === 'pass'
    ? <ShieldCheck className="w-8 h-8 text-success" />
    : report.overallStatus === 'warn'
    ? <ShieldAlert className="w-8 h-8 text-warning" />
    : <ShieldX className="w-8 h-8 text-destructive" />;

  const statusLabel = report.isReady ? 'BI-Ready' : report.overallStatus === 'warn' ? 'Needs Attention' : 'Not Ready';
  const statusColor = report.isReady ? 'text-success' : report.overallStatus === 'warn' ? 'text-warning' : 'text-destructive';

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        {overallIcon}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            BI-Readiness Assessment
          </h3>
          <p className="text-sm text-muted-foreground">
            Professional-grade data integrity verification across 5 pillars
          </p>
        </div>
        <div className="text-right">
          <ScoreBadge score={report.overallScore} large />
          <span className={cn('text-xs font-semibold mt-1 block', statusColor)}>{statusLabel}</span>
        </div>
      </div>

      {/* Pillar Cards */}
      <div className="space-y-2">
        {report.pillars.map((p, i) => (
          <PillarCard key={i} pillar={p} />
        ))}
      </div>

      {/* Domain Violations */}
      <DomainViolationsSection violations={report.domainViolations} />

      {/* Ghost Data */}
      <GhostDataSection ghost={report.ghostData} />

      {/* Reconciliation */}
      <ReconciliationSection report={report} />

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Recommendations
          </h4>
          <ul className="space-y-1.5">
            {report.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', r.startsWith('CRITICAL') ? 'bg-destructive' : r.startsWith('WARNING') ? 'bg-warning' : 'bg-primary')} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
