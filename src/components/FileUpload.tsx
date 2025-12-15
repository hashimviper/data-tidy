import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      if (isValid) {
        setFileName(file.name);
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFileName(files[0].name);
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleChange}
        className="sr-only"
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {fileName ? (
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          ) : (
            <Upload className="w-8 h-8 text-primary" />
          )}
        </div>
        
        {fileName ? (
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">{fileName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click or drop to replace
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">
              Drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-md bg-muted">.csv</span>
          <span className="px-2 py-1 rounded-md bg-muted">.xlsx</span>
          <span className="px-2 py-1 rounded-md bg-muted">.xls</span>
          <span>supported</span>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-foreground">Analyzing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
