import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function signIn(e) {
    e.preventDefault();

    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log(data);
    console.log(error);

    if (error) {
      setError(error.message);
      return;
    }

    onLogin(data.session.user);
    console.log("Logged in user:", data.session.user);
  }

  return (
    <div style={{ maxWidth: 400, margin: "60px auto" }}>
      <h2>Hotel Board Login</h2>

      <form onSubmit={signIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <br /><br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <br /><br />

        <button type="submit">
          Sign In
        </button>
      </form>

      <p style={{ color: "red" }}>{error}</p>
    </div>
  );
}
