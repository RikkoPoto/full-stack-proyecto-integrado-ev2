import { Component } from 'react';

/** Evita la pantalla en blanco si algún componente falla al renderizar. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error de interfaz:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl py-20 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="mt-2 text-sm text-mute">Ocurrió un error inesperado al mostrar esta pantalla. Tus verificaciones no se perdieron.</p>
        <a href="/" className="btn btn-primary mt-6">Volver al inicio</a>
      </div>
    );
  }
}
