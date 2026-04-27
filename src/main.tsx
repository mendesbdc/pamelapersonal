import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ContactFloatingBar } from "./ContactFloatingBar";
import "./styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <section className="panel">
            <p className="eyebrow">Erro na tela</p>
            <h1>Algo não carregou corretamente</h1>
            <p className="error">{this.state.error.message}</p>
            <p className="muted">Recarregue a página com Ctrl + F5. Se continuar, reinicie o start.bat.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <>
        <App />
        <ContactFloatingBar />
      </>
    </ErrorBoundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // O app continua funcionando mesmo se o navegador bloquear o service worker.
    });
  });
}
