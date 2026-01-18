import { useMemo } from 'react';
import { EnhancedCleaningResult } from '@/lib/dataTypes';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, AlertTriangle } from 'lucide-react';

interface BeforeAfterChartsProps {
  result: EnhancedCleaningResult;
}

const COLORS = {
  before: 'hsl(var(--muted-foreground))',
  after: 'hsl(var(--primary))',
  removed: 'hsl(var(--destructive))',
  fixed: 'hsl(var(--success))',
  unchanged: 'hsl(var(--muted))',
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

export function BeforeAfterCharts({ result }: BeforeAfterChartsProps) {
  const { summary, actions, profile, data, originalData } = result;

  // Row comparison data
  const rowData = useMemo(() => [
    { name: 'Rows', before: summary.rowsBefore, after: summary.rowsAfter },
    { name: 'Columns', before: summary.columnsBefore, after: summary.columnsAfter },
  ], [summary]);

  // Changes breakdown
  const changesData = useMemo(() => {
    const changes = [
      { name: 'Duplicates Removed', value: summary.duplicatesRemoved, color: COLORS.removed },
      { name: 'Missing Filled', value: summary.missingValuesHandled, color: COLORS.fixed },
      { name: 'Outliers Handled', value: summary.outliersHandled, color: PIE_COLORS[2] },
      { name: 'Dates Fixed', value: summary.datesFixed, color: PIE_COLORS[3] },
      { name: 'Values Normalized', value: summary.categoricalNormalized, color: PIE_COLORS[4] },
    ].filter(c => c.value > 0);
    
    return changes;
  }, [summary]);

  // Missing values by column
  const missingByColumn = useMemo(() => {
    const columnMissing: { name: string; before: number; after: number }[] = [];
    
    profile.columns.forEach(col => {
      // Get original missing count from issues or profile
      const beforeMissing = col.issues.find(i => i.type === 'missing')?.count || 0;
      
      // After cleaning, count remaining nulls (should be 0 with zero-blank rule)
      const afterMissing = data.filter(row => {
        const val = row[col.name];
        return val === null || val === undefined || val === '';
      }).length;
      
      if (beforeMissing > 0 || afterMissing > 0) {
        columnMissing.push({
          name: col.name.length > 15 ? col.name.substring(0, 12) + '...' : col.name,
          before: beforeMissing,
          after: afterMissing,
        });
      }
    });
    
    return columnMissing.slice(0, 10); // Top 10 columns
  }, [profile.columns, data]);

  // Data quality pie chart
  const qualityData = useMemo(() => {
    const score = profile.dataDescription.dataQualityScore;
    return [
      { name: 'Quality', value: score },
      { name: 'Issues', value: 100 - score },
    ];
  }, [profile.dataDescription.dataQualityScore]);

  // Category distribution for a sample categorical column
  const categoryDistribution = useMemo(() => {
    const catColumn = profile.columns.find(c => 
      c.dataType === 'categorical' && c.categoricalInfo && c.categoricalInfo.uniqueValues.length <= 10
    );
    
    if (!catColumn || !catColumn.categoricalInfo) return null;
    
    const counts: { name: string; count: number }[] = [];
    Object.entries(catColumn.categoricalInfo.valueCounts).forEach(([name, count]) => {
      counts.push({ name: name.length > 15 ? name.substring(0, 12) + '...' : name, count });
    });
    
    // Add Unknown if present in cleaned data
    const unknownCount = data.filter(row => row[catColumn.name] === 'Unknown').length;
    if (unknownCount > 0 && !counts.find(c => c.name === 'Unknown')) {
      counts.push({ name: 'Unknown', count: unknownCount });
    }
    
    return {
      columnName: catColumn.name,
      data: counts.sort((a, b) => b.count - a.count).slice(0, 8),
    };
  }, [profile.columns, data]);

  if (summary.totalChanges === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <TrendingUp className="w-12 h-12 text-success mx-auto mb-4" />
        <h4 className="font-semibold text-foreground mb-2">No Changes Needed</h4>
        <p className="text-sm text-muted-foreground">Your dataset was already clean!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="missing" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Missing Data
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-1.5">
            <PieChartIcon className="w-3.5 h-3.5" />
            Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Row/Column Comparison */}
          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Before vs After Comparison
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rowData} layout="vertical" barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="before" name="Before" fill="hsl(var(--muted-foreground))" radius={4} />
                  <Bar dataKey="after" name="After" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Changes Breakdown */}
          {changesData.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h4 className="font-semibold text-foreground mb-4">Changes Applied</h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={changesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="value" name="Count" radius={4}>
                      {changesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="missing" className="mt-6">
          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Missing Values by Column
            </h4>
            {missingByColumn.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={missingByColumn}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      angle={-30}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="before" name="Before Cleaning" fill="hsl(var(--destructive))" radius={4} />
                    <Bar dataKey="after" name="After Cleaning" fill="hsl(var(--success))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No missing values detected in the dataset.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="mt-6 space-y-6">
          {/* Data Quality Score */}
          <div className="glass-card rounded-xl p-5">
            <h4 className="font-semibold text-foreground mb-4">Data Quality Score</h4>
            <div className="flex items-center justify-center gap-8">
              <div className="h-[200px] w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qualityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="hsl(var(--success))" />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-foreground">
                  {profile.dataDescription.dataQualityScore}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Quality Score</p>
                <Badge 
                  variant={profile.dataDescription.dataQualityScore >= 80 ? 'default' : 'secondary'}
                  className="mt-2"
                >
                  {profile.dataDescription.dataQualityScore >= 90 ? 'Excellent' :
                   profile.dataDescription.dataQualityScore >= 80 ? 'Good' :
                   profile.dataDescription.dataQualityScore >= 60 ? 'Fair' : 'Needs Work'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Category Distribution */}
          {categoryDistribution && (
            <div className="glass-card rounded-xl p-5">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                Category Distribution: 
                <Badge variant="outline">{categoryDistribution.columnName}</Badge>
              </h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryDistribution.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="count" name="Count" fill="hsl(var(--primary))" radius={4}>
                      {categoryDistribution.data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.name === 'Unknown' ? 'hsl(var(--muted-foreground))' : PIE_COLORS[index % PIE_COLORS.length]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
