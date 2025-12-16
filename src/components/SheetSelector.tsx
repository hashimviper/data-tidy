import { useState } from 'react';
import { FileSpreadsheet, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SheetSelectorProps {
  open: boolean;
  sheetNames: string[];
  onSelect: (sheetName: string) => void;
  onCancel: () => void;
}

export function SheetSelector({ open, sheetNames, onSelect, onCancel }: SheetSelectorProps) {
  const [selected, setSelected] = useState<string>(sheetNames[0] || '');

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Select a Sheet
          </DialogTitle>
          <DialogDescription>
            This Excel file contains multiple sheets. Choose which one to analyze.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto py-4">
          {sheetNames.map((name, index) => (
            <button
              key={name}
              onClick={() => setSelected(name)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                selected === name
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50 text-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-medium ${
                  selected === name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              <span className="flex-1 font-medium truncate">{name}</span>
              {selected === name && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Analyze Sheet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
