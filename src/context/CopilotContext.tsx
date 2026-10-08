import React, { createContext, useContext, useState, useCallback } from 'react';
import { FinancialCopilotModal } from '../components/ai/FinancialCopilotModal';

export interface OpenCopilotOptions {
  imageUris?: string[];
  initialPrompt?: string;
  autoSend?: boolean;
}

export interface CopilotContextType {
  isOpen: boolean;
  openCopilot: (options?: OpenCopilotOptions) => void;
  closeCopilot: () => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copilotOptions, setCopilotOptions] = useState<OpenCopilotOptions | undefined>(undefined);

  const openCopilot = useCallback((options?: OpenCopilotOptions) => {
    setCopilotOptions(options);
    setIsOpen(true);
  }, []);

  const closeCopilot = useCallback(() => {
    setIsOpen(false);
    setCopilotOptions(undefined);
  }, []);

  return (
    <CopilotContext.Provider value={{ isOpen, openCopilot, closeCopilot }}>
      {children}
      <FinancialCopilotModal
        visible={isOpen}
        onClose={closeCopilot}
        initialImageUris={copilotOptions?.imageUris}
        initialPrompt={copilotOptions?.initialPrompt}
        autoSend={copilotOptions?.autoSend}
      />
    </CopilotContext.Provider>
  );
};

export const useCopilot = (): CopilotContextType => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
};
