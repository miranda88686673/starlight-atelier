import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Capturou falha:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      let friendlyDetails = this.state.errorMessage ?? 'Erro interno.';
      try {
        const parsed = JSON.parse(friendlyDetails) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed?.error) {
          friendlyDetails = `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} em ${parsed.path})` : ''}`;
        }
      } catch {
        // Mensagem simples
      }

      return (
        <div className="min-h-screen bg-[#0D0B10] text-[#FAF8F4] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#191520] border border-[#3B2E3E] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Algo precisou ser reiniciado
                </h2>
                <p className="text-xs text-[#B8AEBF]">
                  Nocturne Vale Club · Proteção de Sessão
                </p>
              </div>
            </div>
            <p className="text-xs text-[#DDD6E4] bg-black/35 border border-white/10 rounded-lg p-3 break-words">
              {friendlyDetails}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#761334] hover:bg-[#5E0E28] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
