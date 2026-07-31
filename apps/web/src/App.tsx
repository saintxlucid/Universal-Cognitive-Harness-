import { Button } from '@saas/ui';

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Production-ready starter</p>
        <h1>Build your SaaS, web app, and mobile product from one workspace.</h1>
        <p className="subtext">
          This setup includes a scalable monorepo structure, reusable UI components, and a modern
          frontend foundation for rapid delivery.
        </p>
        <div className="actions">
          <Button>Launch App</Button>
          <Button variant="secondary">View Docs</Button>
        </div>
      </section>
    </main>
  );
}
