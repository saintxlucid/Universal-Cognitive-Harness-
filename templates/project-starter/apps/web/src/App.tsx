import { Routes, Route, Link } from "react-router-dom";

function Home() {
  return (
    <main>
      <h1>Welcome</h1>
      <p>Monorepo project running on Turbo + Vite.</p>
      <nav>
        <Link to="/about">About</Link>
      </nav>
    </main>
  );
}

function About() {
  return (
    <main>
      <h1>About</h1>
      <Link to="/">Home</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
