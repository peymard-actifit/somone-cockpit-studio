import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  danger?: boolean;
  confirmLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
    danger: true,
  });
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolveRef?.(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef?.(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        danger={options.danger}
        confirmLabel={options.confirmLabel || 'Supprimer'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}








































