import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Sparkles, CheckCircle2, Zap, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractiveUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const features = [
  { icon: Zap, title: 'Smart Detection', description: 'Auto-detects data types and issues' },
  { icon: Shield, title: 'Safe Cleaning', description: 'Intelligent imputation methods' },
  { icon: BarChart3, title: 'BI-Ready', description: 'Optimized for visualization tools' },
];

export function InteractiveUpload({ onFileSelect, isLoading }: InteractiveUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-4 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-sm font-medium border border-primary/20">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Professional Data Preparation
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          Prepare Your Data for{' '}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Analysis</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Upload your dataset and let our intelligent engine clean, standardize, 
          and optimize it for visualization tools.
        </p>
      </div>

      {/* Upload Zone */}
      <div 
        className={cn(
          "relative group rounded-2xl border-2 border-dashed transition-all duration-300",
          "hover:border-primary/60 hover:bg-accent/30",
          isDragging && "border-primary bg-accent/50 scale-[1.02] shadow-xl shadow-primary/10",
          isLoading && "pointer-events-none opacity-60",
          "cursor-pointer animate-fade-up stagger-2"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isLoading}
        />
        
        <div className="p-12 flex flex-col items-center justify-center text-center">
          {/* Animated Icon */}
          <div className={cn(
            "relative mb-6 transition-transform duration-300",
            (isDragging || isHovering) && "scale-110"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300",
              "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20",
              (isDragging || isHovering) && "shadow-lg shadow-primary/20"
            )}>
              <Upload className={cn(
                "w-8 h-8 text-primary transition-transform duration-300",
                (isDragging || isHovering) && "-translate-y-1"
              )} />
            </div>
            
            {/* Floating particles */}
            {(isDragging || isHovering) && (
              <>
                <div className="absolute -top-2 -left-2 w-3 h-3 bg-primary/40 rounded-full animate-ping" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary/30 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
              </>
            )}
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-2">
            {isDragging ? 'Drop your file here!' : 'Drop your dataset here'}
          </h3>
          <p className="text-muted-foreground mb-4">or click to browse</p>
          
          <div className="flex items-center gap-2">
            {['.csv', '.xlsx', '.xls'].map((format) => (
              <span 
                key={format}
                className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {format}
              </span>
            ))}
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-4 animate-fade-up stagger-3">
        {features.map((feature, index) => (
          <div 
            key={feature.title}
            className="group glass-card rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
