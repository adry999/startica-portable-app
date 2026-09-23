import { total } from '@domain/money.mjs';

// Scaffold placeholder: proves the webapp/ tooling (Vite, TS, @domain alias into
// the backend's src/shared/domain) works end to end before any real screen is built.
export function App() {
  const sample = total([{ amount: 10 }, { amount: 5.5 }]);
  return (
    <main>
      <h1>Startica — scaffold</h1>
      <p>@domain/money.mjs total([10, 5.5]) = {sample}</p>
    </main>
  );
}
