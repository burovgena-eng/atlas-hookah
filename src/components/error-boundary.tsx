'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="bg-slate-800/50 border-slate-700 max-w-md w-full">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Произошла ошибка
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Что-то пошло не так при отображении этой страницы.
                Попробуйте обновить страницу или вернуться позже.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4 p-3 bg-slate-900/50 rounded-lg">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                    Детали ошибки
                  </summary>
                  <pre className="mt-2 text-xs text-red-400 overflow-auto whitespace-pre-wrap">
                    {this.state.error.message}
                    {'\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={this.handleRetry}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Попробовать снова
                </Button>
                <Button
                  onClick={this.handleRefresh}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить страницу
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
