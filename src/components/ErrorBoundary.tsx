import * as React from 'react';
import { Card, Button } from './Neumorphic';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = '应用程序遇到了一个意外错误。';
      try {
        // Check if it's a Firestore JSON error
        const parsed = JSON.parse(this.state.error?.message || '');
        if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
          errorMessage = '权限不足：您可能需要重新登录或检查权限设置。';
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-nm-bg flex items-center justify-center p-6">
          <Card className="max-w-md w-full text-center p-12">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-display font-extrabold mb-4">哎呀，出错了</h2>
            <p className="text-nm-muted mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <Button 
              variant="primary" 
              className="w-full"
              onClick={() => window.location.reload()}
            >
              刷新页面 <RefreshCw size={18} />
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
